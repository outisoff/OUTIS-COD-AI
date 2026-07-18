/**
 * User-friendly error message mapper
 * Maps technical Supabase/database errors to safe, localized messages
 * Prevents information leakage while providing helpful feedback
 */

type ErrorMapping = {
  patterns: string[];
  message: string;
};

const errorMappings: ErrorMapping[] = [
  // Authentication errors
  {
    patterns: ['invalid login credentials', 'invalid email or password'],
    message: 'Email ou mot de passe incorrect',
  },
  {
    patterns: ['email not confirmed', 'email confirmation'],
    message: 'Veuillez confirmer votre email avant de vous connecter',
  },
  {
    patterns: ['user already registered', 'already exists'],
    message: 'Un compte avec cet email existe déjà',
  },
  {
    patterns: ['password should be at least', 'password too short'],
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  },
  {
    patterns: ['rate limit', 'too many requests'],
    message: 'Trop de tentatives. Veuillez réessayer dans quelques minutes',
  },
  {
    patterns: ['network', 'fetch', 'connection'],
    message: 'Erreur de connexion. Vérifiez votre connexion internet',
  },
  // Database constraint errors
  {
    patterns: ['duplicate key', 'unique constraint', 'already exists'],
    message: 'Cette entrée existe déjà',
  },
  {
    patterns: ['foreign key', 'violates foreign key'],
    message: 'Impossible de supprimer: des données liées existent',
  },
  {
    patterns: ['not found', '404'],
    message: 'Élément introuvable',
  },
  // RLS/Permission errors
  {
    patterns: ['row-level security', 'rls', 'permission denied', 'new row violates'],
    message: 'Vous n\'avez pas la permission d\'effectuer cette action',
  },
  // Validation errors
  {
    patterns: ['validation', 'invalid input', 'required'],
    message: 'Données invalides. Vérifiez les champs du formulaire',
  },
];

/**
 * Converts a technical error to a user-friendly message
 * Logs the original error for debugging but returns a safe message for display
 */
export function getUserFriendlyError(error: unknown, defaultMessage?: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowercaseError = errorMessage.toLowerCase();
  
  // Log full error for debugging (server-side/dev tools only)
  console.error('Operation failed:', errorMessage);
  
  // Find matching error pattern
  for (const mapping of errorMappings) {
    for (const pattern of mapping.patterns) {
      if (lowercaseError.includes(pattern.toLowerCase())) {
        return mapping.message;
      }
    }
  }
  
  // Return default or generic message
  return defaultMessage || 'Une erreur est survenue. Veuillez réessayer.';
}

/**
 * Get user-friendly auth error message
 */
export function getAuthErrorMessage(error: unknown): string {
  return getUserFriendlyError(error, 'Impossible de se connecter. Veuillez réessayer.');
}

/**
 * Get user-friendly order error message
 */
export function getOrderErrorMessage(error: unknown): string {
  return getUserFriendlyError(error, 'Impossible de traiter la commande. Veuillez réessayer.');
}

/**
 * Get user-friendly product error message
 */
export function getProductErrorMessage(error: unknown): string {
  return getUserFriendlyError(error, 'Impossible de traiter le produit. Veuillez réessayer.');
}
