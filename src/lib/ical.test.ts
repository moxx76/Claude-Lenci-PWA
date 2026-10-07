import { describe, test, expect } from 'vitest'
import { buildIcs, type IcsEvent } from './ical'

/**
 * Test sulla generazione iCalendar (.ics) per la sottoscrizione calendario
 * dei genitori. Un file malformato fa fallire silenziosamente l'import su
 * iOS Calendar / Google Calendar — meglio accorgersene qui.
 */

describe('buildIcs', () => {
  test('struttura di base conforme RFC 5545', () => {
    const ics = buildIcs([], 'Prova')
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/)
    expect(ics).toMatch(/VERSION:2.0/)
    expect(ics).toMatch(/CALSCALE:GREGORIAN/)
    expect(ics).toMatch(/METHOD:PUBLISH/)
    expect(ics).toMatch(/END:VCALENDAR\r\n$/)
  })

  test('include VTIMEZONE Europe/Rome con CET/CEST', () => {
    const ics = buildIcs([], 'Prova')
    expect(ics).toMatch(/BEGIN:VTIMEZONE/)
    expect(ics).toMatch(/TZID:Europe\/Rome/)
    expect(ics).toMatch(/TZNAME:CET/)
    expect(ics).toMatch(/TZNAME:CEST/)
    expect(ics).toMatch(/TZOFFSETTO:\+0100/)
    expect(ics).toMatch(/TZOFFSETTO:\+0200/)
  })

  test('X-WR-CALNAME e X-WR-TIMEZONE presenti', () => {
    const ics = buildIcs([], 'Lenci U14')
    expect(ics).toMatch(/X-WR-CALNAME:Lenci U14/)
    expect(ics).toMatch(/X-WR-TIMEZONE:Europe\/Rome/)
  })

  test('un evento genera VEVENT con tutti i campi', () => {
    const ev: IcsEvent = {
      uid: 'training-abc@lencipoirino.it',
      start: '2026-10-07T18:30:00',
      title: 'Allenamento U14',
      location: 'Campo Comunale, Poirino',
      description: 'Portare parastinchi',
      url: 'https://lencipoirino.it/calendar',
    }
    const ics = buildIcs([ev], 'Prova')
    expect(ics).toMatch(/BEGIN:VEVENT/)
    expect(ics).toMatch(/UID:training-abc@lencipoirino\.it/)
    expect(ics).toMatch(/SUMMARY:Allenamento U14/)
    expect(ics).toMatch(/LOCATION:Campo Comunale\\, Poirino/)  // virgola escaped
    expect(ics).toMatch(/DESCRIPTION:Portare parastinchi/)
    expect(ics).toMatch(/URL:https:\/\/lencipoirino\.it\/calendar/)
    expect(ics).toMatch(/DTSTART;TZID=Europe\/Rome:20261007T183000/)
    expect(ics).toMatch(/END:VEVENT/)
  })

  test('end di default = start + 90 min', () => {
    const ev: IcsEvent = {
      uid: 'x',
      start: new Date('2026-10-07T18:00:00'),
      title: 'Allenamento',
    }
    const ics = buildIcs([ev], 'Prova')
    expect(ics).toMatch(/DTSTART;TZID=Europe\/Rome:20261007T180000/)
    expect(ics).toMatch(/DTEND;TZID=Europe\/Rome:20261007T193000/)
  })

  test('escape dei caratteri speciali (virgola, punto e virgola, newline, backslash)', () => {
    const ev: IcsEvent = {
      uid: 'x',
      start: new Date('2026-10-07T18:00:00'),
      title: 'Prova; con, caratteri\\speciali\nnewline',
    }
    const ics = buildIcs([ev], 'Prova')
    expect(ics).toMatch(/SUMMARY:Prova\\; con\\, caratteri\\\\speciali\\nnewline/)
  })

  test('line folding: righe > 75 ottetti vengono spezzate con spazio di continuazione', () => {
    const longTitle = 'A'.repeat(100)
    const ev: IcsEvent = {
      uid: 'x',
      start: new Date('2026-10-07T18:00:00'),
      title: longTitle,
    }
    const ics = buildIcs([ev], 'Prova')
    // La riga SUMMARY deve essere spezzata con \r\n + spazio
    const summaryLines = ics.split('\r\n').filter(l => l.includes('AAAA'))
    // Più di una riga che inizia o continua AAAA (quindi folding è avvenuto)
    expect(summaryLines.length).toBeGreaterThan(1)
    // La riga di continuazione inizia con uno spazio
    expect(summaryLines[1][0]).toBe(' ')
  })

  test('più eventi concatenati con VEVENT separati', () => {
    const events: IcsEvent[] = [
      { uid: '1', start: new Date('2026-10-07T18:00:00'), title: 'A' },
      { uid: '2', start: new Date('2026-10-08T18:00:00'), title: 'B' },
      { uid: '3', start: new Date('2026-10-09T18:00:00'), title: 'C' },
    ]
    const ics = buildIcs(events, 'Prova')
    const vevents = ics.match(/BEGIN:VEVENT/g)
    expect(vevents).toHaveLength(3)
  })

  test('location/description/url opzionali: assenti → non emesse', () => {
    const ev: IcsEvent = {
      uid: 'x',
      start: new Date('2026-10-07T18:00:00'),
      title: 'Allenamento',
    }
    const ics = buildIcs([ev], 'Prova')
    expect(ics).not.toMatch(/^LOCATION:/m)
    expect(ics).not.toMatch(/^DESCRIPTION:/m)
    expect(ics).not.toMatch(/^URL:/m)
  })

  test('null in location/description/url ignorato', () => {
    const ev: IcsEvent = {
      uid: 'x',
      start: new Date('2026-10-07T18:00:00'),
      title: 'A',
      location: null,
      description: null,
      url: null,
    }
    const ics = buildIcs([ev], 'Prova')
    expect(ics).not.toMatch(/LOCATION:/)
    expect(ics).not.toMatch(/DESCRIPTION:/)
    expect(ics).not.toMatch(/URL:/)
  })

  test('ISO string e Date producono stesso output', () => {
    const dIso: IcsEvent = { uid: 'x', start: '2026-10-07T18:00:00', title: 'A' }
    const dObj: IcsEvent = { uid: 'x', start: new Date('2026-10-07T18:00:00'), title: 'A' }
    const icsA = buildIcs([dIso], 'Prova')
    const icsB = buildIcs([dObj], 'Prova')
    // DTSTAMP cambia tra chiamate (usa Date.now()), lo rimuoviamo prima del confronto
    const strip = (s: string) => s.replace(/DTSTAMP:\d+T\d+Z\r\n/g, '')
    expect(strip(icsA)).toBe(strip(icsB))
  })
})
