package expo.modules.zebradatawedge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Bridge to Zebra DataWedge (the scan service on Zebra devices such as the
// TC22 with an RFID sled). configure() creates/updates a DataWedge profile for
// this app — RFID input + barcode (QR) input on, keystroke output off, intent
// output on — so tags and QR codes arrive here as broadcasts instead of being
// typed into whatever field has focus. Each read is sent to JS as "onScan".
// DataWedge's answers to the setup commands come back as "onResult" and are
// kept for getStatus(), so a failed setup can be seen in the app.
class ZebraDataWedgeModule : Module() {
  private var scanReceiver: BroadcastReceiver? = null
  private var resultReceiver: BroadcastReceiver? = null
  private val results = LinkedHashMap<String, String>()
  private var dataWedgeVersion: String? = null

  private val context: Context?
    get() = appContext.reactContext

  private val scanAction: String
    get() = "${context?.packageName ?: "com.refurbinics.technician"}.SCAN"

  override fun definition() = ModuleDefinition {
    Name("ZebraDataWedge")

    Events("onScan", "onResult")

    Function("isAvailable") { isDataWedgeInstalled() }

    Function("getStatus") {
      mapOf(
        "installed" to isDataWedgeInstalled(),
        "version" to dataWedgeVersion,
        "scanAction" to scanAction,
        "results" to results.entries.joinToString("\n") { "${it.key}: ${it.value}" }
      )
    }

    Function("configure") { profileName: String -> configure(profileName) }

    OnStartObserving("onScan") { registerScanReceiver() }

    OnStopObserving("onScan") { unregisterScanReceiver() }

    OnDestroy {
      unregisterScanReceiver()
      resultReceiver?.let { r -> runCatching { context?.unregisterReceiver(r) } }
      resultReceiver = null
    }
  }

  private fun isDataWedgeInstalled(): Boolean {
    val ctx = context ?: return false
    return try {
      @Suppress("DEPRECATION")
      ctx.packageManager.getPackageInfo(DATAWEDGE_PACKAGE, 0)
      true
    } catch (e: Exception) {
      false
    }
  }

  // DataWedge is another app, so its broadcasts need an exported receiver
  // on Android 13+.
  private fun register(receiver: BroadcastReceiver, filter: IntentFilter) {
    val ctx = context ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      ctx.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      ctx.registerReceiver(receiver, filter)
    }
  }

  private fun registerScanReceiver() {
    if (scanReceiver != null) return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(c: Context?, intent: Intent?) {
        intent ?: return
        val data = intent.getStringExtra("com.symbol.datawedge.data_string") ?: return
        sendEvent(
          "onScan",
          mapOf(
            "data" to data,
            "labelType" to intent.getStringExtra("com.symbol.datawedge.label_type"),
            "source" to intent.getStringExtra("com.symbol.datawedge.source")
          )
        )
      }
    }
    register(receiver, IntentFilter(scanAction).apply { addCategory(Intent.CATEGORY_DEFAULT) })
    scanReceiver = receiver
  }

  private fun unregisterScanReceiver() {
    scanReceiver?.let { r -> runCatching { context?.unregisterReceiver(r) } }
    scanReceiver = null
  }

  private fun registerResultReceiver() {
    if (resultReceiver != null) return
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(c: Context?, intent: Intent?) {
        intent ?: return
        intent.getBundleExtra("com.symbol.datawedge.api.RESULT_GET_VERSION_INFO")?.let {
          dataWedgeVersion = it.getString("DATAWEDGE")
        }
        val command = intent.getStringExtra("COMMAND_IDENTIFIER") ?: return
        val result = intent.getStringExtra("RESULT") ?: return
        val info = intent.getBundleExtra("RESULT_INFO")?.let { b ->
          @Suppress("DEPRECATION")
          b.keySet().joinToString(", ") { k -> "$k=${b.get(k)}" }
        }
        results[command] = if (info.isNullOrBlank()) result else "$result ($info)"
        sendEvent("onResult", mapOf("command" to command, "result" to result, "info" to info))
      }
    }
    register(
      receiver,
      IntentFilter("com.symbol.datawedge.api.RESULT_ACTION").apply { addCategory(Intent.CATEGORY_DEFAULT) }
    )
    resultReceiver = receiver
  }

  private fun send(extraName: String, value: Any, commandId: String? = null) {
    val ctx = context ?: return
    val intent = Intent("com.symbol.datawedge.api.ACTION").apply {
      setPackage(DATAWEDGE_PACKAGE)
      when (value) {
        is Bundle -> putExtra(extraName, value)
        else -> putExtra(extraName, value.toString())
      }
      if (commandId != null) {
        putExtra("SEND_RESULT", "LAST_RESULT")
        putExtra("COMMAND_IDENTIFIER", commandId)
      }
    }
    ctx.sendBroadcast(intent)
  }

  private fun plugin(name: String, params: Bundle) = Bundle().apply {
    putString("PLUGIN_NAME", name)
    putString("RESET_CONFIG", "true")
    putBundle("PARAM_LIST", params)
  }

  private fun configure(profileName: String): Boolean {
    val ctx = context ?: return false
    if (!isDataWedgeInstalled()) return false
    registerResultReceiver()
    results.clear()

    send("com.symbol.datawedge.api.GET_VERSION_INFO", "")
    // No CREATE_PROFILE: it answers "PROFILE_ALREADY_EXIST - FAILURE" on every
    // start after the first. SET_CONFIG with CREATE_IF_NOT_EXIST creates the
    // profile when missing and updates it when it exists.

    // 1) profile ↔ this app, QR/barcode in, intent out, keystroke off
    val app = Bundle().apply {
      putString("PACKAGE_NAME", ctx.packageName)
      putStringArray("ACTIVITY_LIST", arrayOf("*"))
    }
    val barcode = plugin("BARCODE", Bundle().apply {
      putString("scanner_selection", "auto")
      putString("scanner_input_enabled", "true")
      putString("decoder_qrcode", "true")
    })
    val intentOut = plugin("INTENT", Bundle().apply {
      putString("intent_output_enabled", "true")
      putString("intent_action", scanAction)
      putString("intent_category", Intent.CATEGORY_DEFAULT)
      putString("intent_delivery", "2") // 2 = broadcast
    })
    val keystroke = plugin("KEYSTROKE", Bundle().apply {
      putString("keystroke_output_enabled", "false")
    })
    send("com.symbol.datawedge.api.SET_CONFIG", Bundle().apply {
      putString("PROFILE_NAME", profileName)
      putString("PROFILE_ENABLED", "true")
      putString("CONFIG_MODE", "CREATE_IF_NOT_EXIST")
      putParcelableArray("APP_LIST", arrayOf(app))
      putParcelableArrayList("PLUGIN_CONFIG", arrayListOf(barcode, intentOut, keystroke))
    }, "profile_setup")

    // 2) RFID on its own, so a device without an RFID sled still gets step 1
    val rfid = plugin("RFID", Bundle().apply {
      putString("rfid_input_enabled", "true")
      putString("rfid_hardware_trigger_enabled", "true")
      putString("rfid_beeper_enable", "true")
      putString("rfid_led_enable", "true")
      putString("rfid_filter_duplicate_tags", "true")
    })
    send("com.symbol.datawedge.api.SET_CONFIG", Bundle().apply {
      putString("PROFILE_NAME", profileName)
      putString("PROFILE_ENABLED", "true")
      putString("CONFIG_MODE", "UPDATE")
      putBundle("PLUGIN_CONFIG", rfid)
    }, "rfid_setup")

    return true
  }

  companion object {
    private const val DATAWEDGE_PACKAGE = "com.symbol.datawedge"
  }
}
