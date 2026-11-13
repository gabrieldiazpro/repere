import { buttonClasses } from "@/components/ui/Button";

const fieldCls =
  "mt-1.5 block w-full min-h-12 rounded-xl border border-line bg-white px-3.5 text-base text-ink placeholder:text-muted/80 shadow-[inset_0_1px_2px_rgba(27,31,46,.05)] focus:border-primary focus:outline-none focus-visible:outline-3 focus-visible:outline-primary focus-visible:outline-offset-1";

/**
 * Mini-formulaire du hero : envoie métier, ville et nom à /audit en paramètres d'URL
 * (/audit?trade=…&city=…&businessName=…), où le formulaire complet est prérempli.
 */
export function AuditMiniForm({ idPrefix = "hero", submitLabel = "Tester mon commerce gratuitement" }: { idPrefix?: string; submitLabel?: string }) {
  return (
    <form action="/audit" method="get" className="space-y-4" aria-label="Lancer un audit gratuit">
      <div>
        <label htmlFor={`${idPrefix}-trade`} className="block text-[0.95rem] font-semibold text-ink">
          Votre métier
        </label>
        <input
          id={`${idPrefix}-trade`}
          name="trade"
          type="text"
          required
          autoComplete="organization-title"
          placeholder="ex. plombier, restaurant italien"
          className={fieldCls}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_1.3fr]">
        <div>
          <label htmlFor={`${idPrefix}-city`} className="block text-[0.95rem] font-semibold text-ink">
            Ville
          </label>
          <input
            id={`${idPrefix}-city`}
            name="city"
            type="text"
            required
            defaultValue="Paris"
            autoComplete="address-level2"
            className={fieldCls}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-name`} className="block text-[0.95rem] font-semibold text-ink">
            Nom de votre commerce
          </label>
          <input
            id={`${idPrefix}-name`}
            name="businessName"
            type="text"
            required
            autoComplete="organization"
            placeholder="ex. Plomberie Martin"
            className={fieldCls}
          />
        </div>
      </div>
      <button type="submit" className={buttonClasses({ size: "lg", className: "w-full" })}>
        {submitLabel}
      </button>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted" aria-label="Conditions">
        {["Gratuit", "Sans carte bancaire", "Résultat en quelques minutes"].map((t) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.4l2.8 2.8L12.5 5" />
            </svg>
            {t}
          </li>
        ))}
      </ul>
    </form>
  );
}

export default AuditMiniForm;
