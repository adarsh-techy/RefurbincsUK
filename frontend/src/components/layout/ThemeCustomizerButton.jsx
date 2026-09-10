import { useTheme } from '../../context/ThemeContext';

export default function ThemeCustomizerButton() {
  const { openCustomizer, customTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={openCustomizer}
      title="Customize Theme Colors"
      aria-label="Customize Theme Colors"
      className="group relative flex items-center justify-center rounded-xl p-2 text-emerald-700 transition-all hover:bg-emerald-50 hover:text-emerald-900 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white"
    >
      {/* Dynamic miniature palette icon with current accent color dot */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5 transition-transform group-hover:rotate-12"
      >
        <path d="M12 2C6.49 2 2 6.49 2 12c0 4.41 3.59 8 8 8 1.1 0 2-.9 2-2 0-.49-.18-.94-.48-1.3-.3-.36-.48-.82-.48-1.34 0-1.1.9-2 2-2h2.36c3.64 0 6.6-2.96 6.6-6.6C22 5.04 17.52 2 12 2Zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8s1.5.67 1.5 1.5S7.33 11 6.5 11Zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7Zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7Zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5S18.33 11 17.5 11Z" />
      </svg>
      {/* Current accent indicator dot */}
      <span
        className="absolute bottom-1 right-1 h-2 w-2 rounded-full ring-1 ring-white dark:ring-black"
        style={{ backgroundColor: customTheme.accentColor }}
      />
    </button>
  );
}
