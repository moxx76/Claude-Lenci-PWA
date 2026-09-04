// Genera un file iCalendar (.ics) conforme RFC 5545 e lo scarica sul device
// Supportato nativamente da iOS Calendar, Google Calendar, Outlook, Android

export interface IcsEvent {
  uid: string              // ID univoco stabile (es. "training-<uuid>@lencipoirino.it")
  start: Date | string     // Data inizio (Date o ISO string)
  end?: Date | string      // Data fine (opzionale, default = start + 90 min)
  title: string            // Titolo evento (SUMMARY)
  location?: string | null // Luogo
  description?: string | null // Descrizione dettagliata
  url?: string | null      // URL evento
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

// Formato "20260825T190000" per Europe/Rome; il TZID lo aggiungiamo separatamente
function fmtLocal(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

// Formato UTC "20260825T170000Z" per DTSTAMP
function fmtUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

// Righe .ics vanno spezzate a 75 ottetti (Content Line Folding RFC 5545)
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let i = 0
  while (i < line.length) {
    parts.push(i === 0 ? line.slice(i, i + 75) : ' ' + line.slice(i, i + 74))
    i += i === 0 ? 75 : 74
  }
  return parts.join('\r\n')
}

// Definizione fuso orario Europe/Rome (regola CET/CEST con ora legale)
// Necessario perché senza VTIMEZONE i client mostrano l'evento in UTC
const VTIMEZONE_ROME = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Rome',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

export function buildIcs(events: IcsEvent[], calendarName: string): string {
  const now = new Date()
  const dtstamp = fmtUtc(now)

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ASD Lenci Poirino//Presenze//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`),
    'X-WR-TIMEZONE:Europe/Rome',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...VTIMEZONE_ROME,
  ]

  for (const ev of events) {
    const start = typeof ev.start === 'string' ? new Date(ev.start) : ev.start
    const end = ev.end
      ? (typeof ev.end === 'string' ? new Date(ev.end) : ev.end)
      : new Date(start.getTime() + 90 * 60 * 1000) // default +90 min
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.uid}`)
    lines.push(`DTSTAMP:${dtstamp}`)
    lines.push(`DTSTART;TZID=Europe/Rome:${fmtLocal(start)}`)
    lines.push(`DTEND;TZID=Europe/Rome:${fmtLocal(end)}`)
    lines.push(foldLine(`SUMMARY:${escapeText(ev.title)}`))
    if (ev.location) lines.push(foldLine(`LOCATION:${escapeText(ev.location)}`))
    if (ev.description) lines.push(foldLine(`DESCRIPTION:${escapeText(ev.description)}`))
    if (ev.url) lines.push(foldLine(`URL:${ev.url}`))
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

// Trigger download del .ics generato
export function downloadIcs(events: IcsEvent[], calendarName: string, filename: string) {
  const ics = buildIcs(events, calendarName)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : filename + '.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 500)
}
