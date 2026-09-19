const fs = require('fs');
const path = require('path');
const invoiceModel = require('../models/invoice.model');
const clientModel = require('../models/client.model');
const auditLogModel = require('../models/audit-log.model');
const trashModel = require('../models/trash.model');
const mailerService = require('../services/mailer.service');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'invoices');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

async function list(req, res, next) {
  try {
    const { clientId, status, search, date } = req.query;
    const invoices = await invoiceModel.findAll({ clientId, status, search, date });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const invoice = await invoiceModel.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      clientId,
      invoiceNumber,
      title,
      amount,
      currency,
      status,
      issueDate,
      dueDate,
      notes,
      sendEmail,
      recipientEmail,
    } = req.body;

    if (!clientId) {
      return res.status(400).json({ message: 'Please select a client.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please attach an invoice PDF or image file.' });
    }

    const resolvedNumber = (title || invoiceNumber || req.file.originalname.replace(/\.[^/.]+$/, '') || `INV-${Date.now()}`).trim();

    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const safeName = `inv-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, req.file.buffer);

    const invoice = await invoiceModel.create({
      clientId: Number(clientId),
      invoiceNumber: resolvedNumber,
      amount: Number(amount) || 0,
      currency: (currency || 'INR').toUpperCase(),
      status: status || 'sent',
      issueDate: issueDate || null,
      dueDate: dueDate || null,
      notes: notes || null,
      filePath: safeName,
      fileName,
      fileSize,
      createdByUserId: req.user.id,
    });

    await auditLogModel.record({
      userId: req.user.id,
      action: 'create',
      entity: 'invoice',
      entityId: invoice.id,
      details: { invoiceNumber: invoice.invoice_number, clientId, amount: invoice.amount },
    });

    // Optionally dispatch invoice email to client
    if (sendEmail === 'true' || sendEmail === true || sendEmail === '1') {
      clientModel.findById(Number(clientId)).then((client) => {
        const emailTo = (recipientEmail || client?.invoice_email || client?.login_email || '').trim();
        if (emailTo) {
          mailerService.sendInvoiceEmail({
            to: emailTo,
            clientName: client?.name || '',
            invoiceNumber: invoice.invoice_number,
            issueDate: invoice.issue_date,
            dueDate: invoice.due_date,
            notes: invoice.notes,
            filePath: safeName,
            fileName,
            status: invoice.status,
          }).catch((mailErr) => {
            console.error('[InvoiceController] Failed to send invoice email:', mailErr.message);
          });
        }
      }).catch((clientErr) => {
        console.error('[InvoiceController] Error looking up client for invoice email:', clientErr.message);
      });
    }

    res.status(201).json(invoice);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'An invoice with this invoice number already exists.' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await invoiceModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }

    const {
      clientId,
      invoiceNumber,
      amount,
      currency,
      status,
      issueDate,
      dueDate,
      notes,
    } = req.body;

    let filePath = existing.file_path;
    let fileName = existing.file_name;
    let fileSize = existing.file_size;

    if (req.file) {
      fileName = req.file.originalname;
      fileSize = req.file.size;
      const safeName = `inv-${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const newPath = path.join(UPLOADS_DIR, safeName);
      fs.writeFileSync(newPath, req.file.buffer);

      // Clean up previous file if existing
      if (existing.file_path) {
        const oldPath = path.join(UPLOADS_DIR, existing.file_path);
        if (fs.existsSync(oldPath)) {
          try { fs.unlinkSync(oldPath); } catch (_) {}
        }
      }
      filePath = safeName;
    }

    const updated = await invoiceModel.update(req.params.id, {
      clientId: clientId ? Number(clientId) : existing.client_id,
      invoiceNumber: invoiceNumber ? invoiceNumber.trim().toUpperCase() : existing.invoice_number,
      amount: amount !== undefined ? Number(amount) : existing.amount,
      currency: currency || existing.currency,
      status: status || existing.status,
      issueDate: issueDate || existing.issue_date,
      dueDate: dueDate !== undefined ? dueDate : existing.due_date,
      notes: notes !== undefined ? notes : existing.notes,
      filePath,
      fileName,
      fileSize,
    });

    await auditLogModel.record({
      userId: req.user.id,
      action: 'update',
      entity: 'invoice',
      entityId: updated.id,
      details: { invoiceNumber: updated.invoice_number, status: updated.status },
    });

    res.json(updated);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'An invoice with this invoice number already exists.' });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await invoiceModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Invoice not found.' });
    }

    if (existing.file_path) {
      const fullPath = path.join(UPLOADS_DIR, existing.file_path);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (_) {}
      }
    }

    await invoiceModel.remove(req.params.id);

    try {
      await trashModel.record({
        originalId: existing.id,
        itemType: 'invoice',
        title: `Invoice #${existing.invoice_number || existing.id}`,
        subtitle: `Client: ${existing.client_name || 'N/A'} • Total: £${existing.total_amount || 0} • Status: ${existing.status || 'N/A'}`,
        itemData: existing,
        user: req.user,
      });
    } catch (trashErr) {
      console.error('Error logging invoice to trash:', trashErr);
    }

    await auditLogModel.record({
      userId: req.user.id,
      action: 'delete',
      entity: 'invoice',
      entityId: Number(req.params.id),
      details: { invoiceNumber: existing.invoice_number },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Download or view attached PDF invoice file
async function downloadFile(req, res, next) {
  try {
    const invoice = await invoiceModel.findById(req.params.id);
    if (!invoice || !invoice.file_path) {
      return res.status(404).json({ message: 'Invoice PDF file not found.' });
    }

    // Security: If caller is client role, ensure this invoice belongs to their client_id
    if (req.user.role === 'client') {
      const client = await clientModel.findByUserId(req.user.id);
      if (!client || Number(client.id) !== Number(invoice.client_id)) {
        return res.status(403).json({ message: 'Access denied to this invoice.' });
      }
    }

    const fullPath = path.join(UPLOADS_DIR, invoice.file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File is no longer on disk.' });
    }

    const ext = path.extname(invoice.file_path || invoice.file_name || '').toLowerCase();
    const downloadName = invoice.file_name || `Invoice-${invoice.invoice_number}${ext || '.pdf'}`;
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };
    const contentType = mimeMap[ext] || 'application/pdf';
    const isAttachment = req.query.download === 'true' || req.query.download === '1';
    const disposition = isAttachment ? 'attachment' : 'inline';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(downloadName)}"`);
    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  downloadFile,
};
