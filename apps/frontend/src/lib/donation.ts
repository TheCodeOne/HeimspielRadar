export const DEFAULT_DONATION_URL = 'https://buymeacoffee.com/dimi.kokkonias';

export const DEFAULT_TRANSPARENCY_URL =
  'https://github.com/TheCodeOne/HeimspielRadar/blob/main/TRANSPARENCY.md';

/**
 * Returns the configured donation URL from Vite environment variables or defaults to Buy Me a Coffee.
 */
export function getDonationUrl(): string {
  return import.meta.env.VITE_DONATION_URL || DEFAULT_DONATION_URL;
}

/**
 * Returns the configured transparency URL from Vite environment variables or defaults to the GitHub repo TRANSPARENCY.md.
 */
export function getTransparencyUrl(): string {
  return import.meta.env.VITE_TRANSPARENCY_URL || DEFAULT_TRANSPARENCY_URL;
}
