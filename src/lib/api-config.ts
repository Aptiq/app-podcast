// Configuration des API pour le générateur de podcasts
export interface ApiConfig {
  openai?: string;
  gemini?: string;
  elevenlabs?: string;
}

// Fonction pour récupérer les clés API du localStorage
export function getApiKeys(): ApiConfig {
  if (typeof window === 'undefined') return {};
  
  try {
    const keys = localStorage.getItem('podcast-api-keys');
    return keys ? JSON.parse(keys) : {};
  } catch (error) {
    console.error('Erreur lors de la récupération des clés API:', error);
    return {};
  }
}

// Fonction pour sauvegarder les clés API dans le localStorage
export function saveApiKeys(config: ApiConfig): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('podcast-api-keys', JSON.stringify(config));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des clés API:', error);
  }
}

// Fonction pour vérifier si les clés API sont configurées
export function hasApiKeys(): boolean {
  const keys = getApiKeys();
  return !!(keys.openai || keys.gemini || keys.elevenlabs);
} 