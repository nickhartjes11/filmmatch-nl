export type MovieReaction = 'like' | 'dislike' | 'unseen';

export interface OnboardingMovie {
  id: number;
  title: string;
  poster_path: string;
  year: string;
  genres: string[];
  director?: string;
  cast?: string[];
}

const movie = (id: number, title: string, year: string, genres: string[], director?: string): OnboardingMovie =>
  ({ id, title, year, genres, director, poster_path: '' });

// Stable, intentionally broad starting selection. Availability does not affect this list.
export const ONBOARDING_MOVIES: OnboardingMovie[] = [
  movie(862, 'Toy Story', '1995', ['Animatie', 'Familie', 'Komedie'], 'John Lasseter'),
  movie(157336, 'Interstellar', '2014', ['Sciencefiction', 'Drama', 'Avontuur'], 'Christopher Nolan'),
  movie(671, 'Harry Potter en de Steen der Wijzen', '2001', ['Avontuur', 'Fantasy', 'Familie'], 'Chris Columbus'),
  movie(808, 'Shrek', '2001', ['Animatie', 'Komedie', 'Familie', 'Fantasy'], 'Andrew Adamson'),
  movie(8587, 'The Lion King', '1994', ['Animatie', 'Familie', 'Drama'], 'Roger Allers'),
  movie(120, 'The Lord of the Rings: The Fellowship of the Ring', '2001', ['Avontuur', 'Fantasy', 'Actie'], 'Peter Jackson'),
  movie(329, 'Jurassic Park', '1993', ['Avontuur', 'Sciencefiction', 'Thriller'], 'Steven Spielberg'),
  movie(24428, 'The Avengers', '2012', ['Sciencefiction', 'Actie', 'Avontuur'], 'Joss Whedon'),
  movie(245891, 'John Wick', '2014', ['Actie', 'Thriller'], 'Chad Stahelski'),
  movie(13, 'Forrest Gump', '1994', ['Komedie', 'Drama', 'Romantiek'], 'Robert Zemeckis'),
  movie(597, 'Titanic', '1997', ['Drama', 'Romantiek'], 'James Cameron'),
  movie(11036, 'The Notebook', '2004', ['Romantiek', 'Drama'], 'Nick Cassavetes'),
  movie(350, 'The Devil Wears Prada', '2006', ['Drama', 'Komedie'], 'David Frankel'),
  movie(18785, 'The Hangover', '2009', ['Komedie'], 'Todd Phillips'),
  movie(11631, 'Mamma Mia!', '2008', ['Komedie', 'Romantiek', 'Muziek'], 'Phyllida Lloyd'),
  movie(346698, 'Barbie', '2023', ['Komedie', 'Avontuur'], 'Greta Gerwig'),
  movie(77338, 'Intouchables', '2011', ['Drama', 'Komedie'], 'Olivier Nakache'),
  movie(5497, 'Alles is Liefde', '2007', ['Komedie', 'Romantiek'], 'Joram Lürsen'),
  movie(278, 'The Shawshank Redemption', '1994', ['Drama', 'Misdaad'], 'Frank Darabont'),
  movie(106646, 'The Wolf of Wall Street', '2013', ['Misdaad', 'Drama', 'Komedie'], 'Martin Scorsese'),
  movie(68718, 'Django Unchained', '2012', ['Drama', 'Western'], 'Quentin Tarantino'),
  movie(857, 'Saving Private Ryan', '1998', ['Drama', 'Historisch', 'Oorlog'], 'Steven Spielberg'),
  movie(496243, 'Parasite', '2019', ['Komedie', 'Thriller', 'Drama'], 'Bong Joon Ho'),
  movie(419430, 'Get Out', '2017', ['Mysterie', 'Thriller', 'Horror'], 'Jordan Peele'),
  movie(138843, 'The Conjuring', '2013', ['Horror', 'Thriller'], 'James Wan'),
];

export const ALTERNATIVE_MOVIES: OnboardingMovie[] = [
  movie(27205, 'Inception', '2010', ['Sciencefiction', 'Thriller'], 'Christopher Nolan'),
  movie(155, 'The Dark Knight', '2008', ['Actie', 'Misdaad', 'Drama'], 'Christopher Nolan'),
  movie(329865, 'Arrival', '2016', ['Sciencefiction', 'Drama'], 'Denis Villeneuve'),
  movie(872585, 'Oppenheimer', '2023', ['Drama', 'Historisch'], 'Christopher Nolan'),
  movie(680, 'Pulp Fiction', '1994', ['Thriller', 'Misdaad'], 'Quentin Tarantino'),
  movie(550, 'Fight Club', '1999', ['Drama', 'Thriller'], 'David Fincher'),
  movie(348, 'Alien', '1979', ['Horror', 'Sciencefiction'], 'Ridley Scott'),
  movie(194, 'Amélie', '2001', ['Komedie', 'Romantiek'], 'Jean-Pierre Jeunet'),
  movie(150540, 'Inside Out', '2015', ['Animatie', 'Familie', 'Komedie'], 'Pete Docter'),
  movie(354912, 'Coco', '2017', ['Animatie', 'Familie', 'Muziek'], 'Lee Unkrich'),
  movie(12, 'Finding Nemo', '2003', ['Animatie', 'Familie', 'Avontuur'], 'Andrew Stanton'),
  movie(109445, 'Frozen', '2013', ['Animatie', 'Familie', 'Fantasy'], 'Chris Buck'),
  movie(129, 'Spirited Away', '2001', ['Animatie', 'Fantasy', 'Familie'], 'Hayao Miyazaki'),
  movie(105, 'Back to the Future', '1985', ['Avontuur', 'Komedie', 'Sciencefiction'], 'Robert Zemeckis'),
  movie(22, 'Pirates of the Caribbean: The Curse of the Black Pearl', '2003', ['Avontuur', 'Fantasy', 'Actie'], 'Gore Verbinski'),
  movie(11, 'Star Wars', '1977', ['Avontuur', 'Actie', 'Sciencefiction'], 'George Lucas'),
  movie(313369, 'La La Land', '2016', ['Romantiek', 'Drama', 'Muziek'], 'Damien Chazelle'),
  movie(244786, 'Whiplash', '2014', ['Drama', 'Muziek'], 'Damien Chazelle'),
  movie(120467, 'The Grand Budapest Hotel', '2014', ['Komedie', 'Drama'], 'Wes Anderson'),
  movie(546554, 'Knives Out', '2019', ['Komedie', 'Misdaad', 'Mysterie'], 'Rian Johnson'),
  movie(509, 'Notting Hill', '1999', ['Romantiek', 'Komedie'], 'Roger Michell'),
  movie(634, "Bridget Jones's Diary", '2001', ['Komedie', 'Romantiek'], 'Sharon Maguire'),
  movie(424694, 'Bohemian Rhapsody', '2018', ['Muziek', 'Drama'], 'Bryan Singer'),
  movie(37165, 'The Truman Show', '1998', ['Komedie', 'Drama'], 'Peter Weir'),
  movie(4232, 'Scream', '1996', ['Misdaad', 'Horror', 'Mysterie'], 'Wes Craven'),
];

export function canFinishTasteSelection(likes: readonly number[], dislikes: readonly number[]): boolean {
  const positive = new Set(likes);
  const judged = new Set([...likes, ...dislikes]);
  return positive.size >= 3 && judged.size >= 5;
}

export function toOnboardingMovie(value: unknown): OnboardingMovie | null {
  if (!value || typeof value !== 'object') return null;
  const m = value as Record<string, unknown>;
  if (!Number.isSafeInteger(m.id) || Number(m.id) <= 0 || typeof m.title !== 'string') return null;
  return {
    id: Number(m.id), title: m.title,
    poster_path: typeof m.poster_path === 'string' ? m.poster_path : '',
    year: typeof m.year === 'string' ? m.year : typeof m.release_date === 'string' ? m.release_date.slice(0, 4) : '',
    genres: Array.isArray(m.genres) ? m.genres.filter((g): g is string => typeof g === 'string') : [],
    director: typeof m.director === 'string' ? m.director : undefined,
    cast: Array.isArray(m.cast) ? m.cast.filter((c): c is string => typeof c === 'string') : undefined,
  };
}
