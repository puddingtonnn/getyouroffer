import { useEffect } from 'react'

const BASE = 'GetYourOffer'

// Sets the browser-tab title for the current route; restores the default
// marketing title when the component unmounts.
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE}` : `${BASE} — отклик на вакансию за минуту`
    return () => {
      document.title = `${BASE} — отклик на вакансию за минуту`
    }
  }, [title])
}
