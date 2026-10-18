export interface EditorialTip {
  tmdbId: number;
  reasonTitle?: string;
  reason: string;
}

export const MONTHLY_TIPS: EditorialTip[] = [
  {
    tmdbId: 671, // Harry Potter and the Philosopher's Stone
    reasonTitle: 'Terug naar Hogwarts',
    reason: 'Omdat de gloednieuwe HBO-serie eraan komt: hét perfecte moment om te herontdekken waar de magie ooit begon.',
  },
  {
    tmdbId: 299534, // Avengers: Endgame
    reasonTitle: 'Opwarmen voor Doomsday',
    reason: 'Met Avengers: Doomsday in aantocht in de bioscoop is dit het ideale moment voor de ultieme Marvel-climax.',
  },
  {
    tmdbId: 438631, // Dune (Part One)
    reasonTitle: 'Het begin van een meesterwerk',
    reason: 'Fenomenale cinematografie en meeslepende worldbuilding van Denis Villeneuve die je simpelweg gezien moet hebben.',
  },
  {
    tmdbId: 693134, // Dune: Part Two
    reasonTitle: 'Moderne sci-fi mijlpaal',
    reason: 'Visueel spektakel van de bovenste plank — een adembenemend vervolg dat alle verwachtingen overtrof.',
  },
  {
    tmdbId: 157336, // Interstellar
    reasonTitle: 'Tijdloze klassieker',
    reason: 'Christopher Nolans audiovisuele meesterwerk over liefde, zwarte gaten en de relativiteit van tijd blijft onovertroffen.',
  },
];