/** App tiles (background, letter colour, letter), shared by the Shelf room's screens and the desk list. */
export const APP_COLORS: Record<string, [string, string, string]> = {
  'Notion': ['#FFFFFF', '#111111', 'N'], 'Obsidian': ['#7C3AED', '#FFFFFF', 'O'], 'Claude': ['#D97757', '#FFFFFF', 'C'],
  'Wispr Flow': ['#F1EEE6', '#111111', 'W'], 'Todoist': ['#E44332', '#FFFFFF', 'T'], 'Google Chrome': ['#4285F4', '#FFFFFF', 'G'],
  'Figma': ['#1E1E1E', '#FFFFFF', 'F'], 'Spotify': ['#1DB954', '#0B0B0B', 'S'], 'Sudoku': ['#F4F1EA', '#222222', '9'],
  'X': ['#000000', '#FFFFFF', 'X'], 'Reddit': ['#FF4500', '#FFFFFF', 'r'], 'NYT Games': ['#FFFFFF', '#111111', 'G'],
};

/** Official app icons (square, 128px) in public/images/shelf/apps. */
export const APP_ICONS: Record<string, string> = {
  'Notion': 'notion', 'Obsidian': 'obsidian', 'Claude': 'claude', 'Wispr Flow': 'wispr-flow', 'Todoist': 'todoist', 'Google Chrome': 'google-chrome',
  'Figma': 'figma', 'Spotify': 'spotify', 'Sudoku': 'sudoku', 'X': 'x', 'Reddit': 'reddit', 'NYT Games': 'nyt-games',
};
export const appIcon = (name: string) => (APP_ICONS[name] ? `/images/shelf/apps/${APP_ICONS[name]}.webp` : '');
