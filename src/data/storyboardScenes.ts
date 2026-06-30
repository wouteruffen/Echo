export interface StoryboardScene {
  id: number
  title: string
  narration: string
}

// ── Edit scenes here to change the storyboard content ─────────────────
// To add a scene: append a new object to the array.
// To reorder: move objects up or down.
// The component reads this array in order, scene 1 first.

export const storyboardScenes: StoryboardScene[] = [
  {
    id: 1,
    title: 'Goedemorgen',
    narration:
      'Goedemorgen Wouter. Je eerste afspraak begint om 09:00. ' +
      'Vanwege regen en extra verkeersdrukte adviseer ik om om 08:05 te vertrekken.',
  },
  {
    id: 2,
    title: 'Koelkast & Boodschappen',
    narration:
      'De melk is bijna op. Ook heb je nog maar één ontbijt voor morgen. ' +
      'Zal ik deze toevoegen aan je boodschappenlijst?',
  },
  {
    id: 3,
    title: 'Vertrek',
    narration:
      'Huis staat in afwezigheidsmodus. Geschatte aankomsttijd op locatie: 08:42. ' +
      'Robotstofzuiger gestart. Verlichting uitgeschakeld. ' +
      'Verwarming op energiebesparing. Alarmsysteem ingeschakeld.',
  },
  {
    id: 4,
    title: 'Reisvertraging',
    narration:
      'Er is een vertraging van 12 minuten op je huidige route vanwege een ongeval op de A10. ' +
      'Er is een alternatieve route beschikbaar. Wil je de alternatieve route nemen?',
  },
  {
    id: 5,
    title: 'Vergadering afgerond',
    narration:
      'Vergadering afgerond. Ik heb drie actiepunten herkend en opgeslagen. ' +
      'Project Nova planning afronden en delen met het team. ' +
      'Budgetvoorstel uiterlijk woensdag aanleveren. ' +
      'Klantfeedback analyseren en rapport opstellen.',
  },
  {
    id: 6,
    title: 'Pauzeadvies',
    narration:
      'Je hebt inmiddels vier uur achter elkaar gezeten. ' +
      'Een korte wandeling van tien minuten wordt aanbevolen. ' +
      'Zal ik een geschikt moment in je agenda reserveren?',
  },
  {
    id: 7,
    title: 'Boodschappenlijst',
    narration:
      'Boodschappenlijst geactiveerd. Alle producten voor de komende twee dagen staan op je lijst. ' +
      'De melk staat nog op je lijst. ' +
      'Zal ik aanbiedingen voor gezonde alternatieven tonen?',
  },
  {
    id: 8,
    title: 'Welkom thuis',
    narration:
      'Welkom thuis, Wouter. De woonkamer staat klaar in avondmodus. ' +
      'Verlichting aan op zeventig procent. ' +
      'Verwarming ingesteld op twintig en een halve graad. ' +
      'Muziek gestart met de Chill and Relax playlist. ' +
      'Beveiliging uitgeschakeld.',
  },
  {
    id: 9,
    title: 'Einde van de dag',
    narration:
      'Slaap lekker, Wouter. Hier is je dag samengevat. ' +
      'Drie actiepunten afgerond. Tien minuten wandeling behaald. ' +
      'Gezonde keuzes gemaakt. Alle boodschappen op de lijst zijn gebalanceerd. ' +
      'Verlichting verlaagd naar zestig procent. ' +
      'Morgen om 07:30 staat je eerste afspraak gepland. ' +
      'Slaapmodus is actief.',
  },
]
