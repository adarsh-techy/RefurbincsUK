// Consistent page title + optional description + right-aligned actions,
// used at the top of every feature page.
// titleClassName/titleStyle: optional overrides for one-off title styling
// (e.g. a page that wants its title in a different color or with an effect).
function PageHeader({ title, description, children, titleClassName, titleStyle }) {
  return (
    <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1
          className={
            titleClassName ||
            'text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-neutral-100'
          }
          style={titleStyle}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500 dark:text-neutral-400">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2 flex-wrap self-start sm:self-auto">{children}</div>}
    </div>
  );
}

export default PageHeader;
