/**
 * §17.6 / §3.7.4 PDF メタデータ Author の opt-in 設定。
 *
 * 既定では Author は空 (PDF メタデータに含まれない)。
 * ユーザーが「自分の名前を PDF に含める」を ON にしたときだけ
 * localStorage("pdfAuthor") に保存され、PDF メタデータに記入される。
 */

const KEY_PDF_AUTHOR = 'pdfAuthor'
const KEY_PDF_AUTHOR_OPTIN = 'pdfAuthorOptIn'

export function getAuthorPreference(): { optIn: boolean; name: string } {
  try {
    const optIn = localStorage.getItem(KEY_PDF_AUTHOR_OPTIN) === 'true'
    const name = localStorage.getItem(KEY_PDF_AUTHOR) ?? ''
    return { optIn, name }
  } catch {
    return { optIn: false, name: '' }
  }
}

export function setAuthorPreference(args: { optIn: boolean; name: string }): void {
  try {
    localStorage.setItem(KEY_PDF_AUTHOR_OPTIN, args.optIn ? 'true' : 'false')
    if (args.optIn && args.name.trim().length > 0) {
      localStorage.setItem(KEY_PDF_AUTHOR, args.name.trim())
    } else {
      localStorage.removeItem(KEY_PDF_AUTHOR)
    }
  } catch {
    // ignore (private browsing 等)
  }
}

/** PDF 出力時にメタデータへ書く値。opt-in OFF か名前空なら undefined を返す (= 空のまま) */
export function resolveAuthorForPdf(): string | undefined {
  const pref = getAuthorPreference()
  if (!pref.optIn) return undefined
  if (pref.name.trim().length === 0) return undefined
  return pref.name.trim()
}
