"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface AudioPlayerProps {
  title: string;
  audioUrl: string;
}

export default function AudioPlayer({ title, audioUrl }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Vérifier si l'URL audio est valide
  const isValidUrl = audioUrl && (
    audioUrl.startsWith('http') || 
    audioUrl.startsWith('/') || 
    audioUrl.startsWith('blob:')
  );

  // Fonction pour tester si l'URL est accessible
  const testAudioUrl = async (url: string): Promise<boolean> => {
    try {
      // Si l'URL est relative, on la convertit en URL absolue
      const fullUrl = url.startsWith('/') 
        ? `${window.location.origin}${url}`
        : url;
      
      console.log("Test d'accès à l'URL audio:", fullUrl);
      
      // Tester l'accès à l'URL avec fetch
      const response = await fetch(fullUrl, { method: 'HEAD' });
      
      console.log("Réponse du test d'URL:", response.status, response.statusText);
      
      return response.ok;
    } catch (error) {
      console.error("Erreur lors du test d'URL:", error);
      return false;
    }
  };

  // Créer l'élément audio lors du montage du composant
  useEffect(() => {
    // Réinitialiser l'état
    setIsLoading(true);
    setHasError(false);
    setErrorMessage("");
    
    console.log("AudioPlayer - URL audio reçue:", audioUrl);
    
    // Si l'URL n'est pas valide, ne pas essayer de charger l'audio
    if (!isValidUrl) {
      console.error("URL audio invalide:", audioUrl);
      setIsLoading(false);
      setHasError(true);
      setErrorMessage("URL audio invalide");
      return;
    }
    
    // Tester si l'URL est accessible
    testAudioUrl(audioUrl).then(isAccessible => {
      if (!isAccessible) {
        console.error("URL audio inaccessible:", audioUrl);
        setIsLoading(false);
        setHasError(true);
        setErrorMessage("Fichier audio introuvable ou inaccessible");
        toast.error("Le fichier audio est introuvable ou inaccessible");
        return;
      }
      
      // Créer un nouvel élément audio
      const audio = new Audio();
      audioRef.current = audio;
      
      // Configurer les gestionnaires d'événements avant de définir la source
      audio.addEventListener('loadeddata', () => {
        console.log("Audio chargé avec succès");
        setIsLoading(false);
      });
      
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      
      // Gestion des erreurs de chargement
      audio.addEventListener('error', (e) => {
        console.error("Erreur de chargement audio:", e);
        setIsLoading(false);
        setHasError(true);
        setErrorMessage(`Erreur de chargement: ${audio.error?.message || 'Erreur inconnue'}`);
        toast.error("Impossible de charger l'audio. Veuillez réessayer.");
      });
      
      // Définir la source après avoir configuré les gestionnaires d'événements
      try {
        audio.src = audioUrl;
        audio.load(); // Forcer le chargement
      } catch (error) {
        console.error("Exception lors du chargement audio:", error);
        setIsLoading(false);
        setHasError(true);
        setErrorMessage(`Exception: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        toast.error("Erreur lors du chargement de l'audio");
      }
    });
    
    // Nettoyage lors du démontage du composant
    return () => {
      if (audioRef.current) {
        const audio = audioRef.current;
        audio.pause();
        audio.src = '';
        audio.removeEventListener('loadeddata', () => {});
        audio.removeEventListener('ended', () => {});
        audio.removeEventListener('error', () => {});
      }
    };
  }, [audioUrl, isValidUrl]);

  // Fonction pour télécharger l'audio
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isValidUrl) {
      window.open(audioUrl, '_blank');
    }
  };

  // Fonction pour réessayer de charger l'audio
  const handleRetry = () => {
    // Réinitialiser l'état et recharger l'audio
    setIsLoading(true);
    setHasError(false);
    setErrorMessage("");
    
    // Forcer le rechargement en ajoutant un timestamp à l'URL
    const refreshedUrl = audioUrl.includes('?') 
      ? `${audioUrl}&t=${Date.now()}` 
      : `${audioUrl}?t=${Date.now()}`;
    
    // Créer un nouvel élément audio
    if (audioRef.current) {
      audioRef.current.src = refreshedUrl;
      audioRef.current.load();
    }
  };

  return (
    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mt-4">
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      
      {isLoading ? (
        <div className="space-y-2">
          <Progress value={30} className="w-full" />
          <p className="text-sm text-center text-gray-500">Chargement de l'audio...</p>
        </div>
      ) : hasError ? (
        <div className="p-4 bg-red-50 text-red-800 rounded-md space-y-2">
          <p>Impossible de charger l'audio. Veuillez vérifier que le fichier existe et est accessible.</p>
          {errorMessage && <p className="text-sm">{errorMessage}</p>}
          <div className="flex justify-end mt-2">
            <Button 
              variant="outline" 
              onClick={handleRetry}
            >
              Réessayer
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <audio 
            src={audioUrl}
            controls 
            className="w-full" 
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
          
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={handleDownload}
            >
              Télécharger
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 