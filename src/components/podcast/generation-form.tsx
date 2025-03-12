"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { ContentSource, GenerationParams, OpenAIVoice, ELEVENLABS_VOICES } from '@/lib/types';
import { hasApiKeys, getApiKeys } from '@/lib/api-config';
import AudioPlayer from './audio-player';

// Schéma de validation pour le formulaire
const generationSchema = z.object({
  // Source de contenu
  contentType: z.enum(['text', 'url']),
  content: z.string().min(10, "Le contenu doit contenir au moins 10 caractères"),
  
  // Paramètres basiques
  length: z.number().min(500).max(5000),
  style: z.enum(['conversational', 'debate', 'interview', 'educational']),
  firstSpeaker: z.string().min(1, "Le rôle du premier intervenant est requis"),
  secondSpeaker: z.string().min(1, "Le rôle du second intervenant est requis"),
  podcastName: z.string().min(1, "Le nom du podcast est requis"),
  tagline: z.string().optional(),
  language: z.enum(['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja']),
  
  // Paramètres avancés
  ttsModel: z.enum(['openai', 'elevenlabs', 'edge']),
  creativity: z.number().min(0).max(1),
  
  // Voix des intervenants (OpenAI)
  firstSpeakerVoice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']),
  secondSpeakerVoice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']),
  
  // Voix des intervenants (ElevenLabs)
  firstSpeakerElevenLabsVoiceId: z.string().optional(),
  secondSpeakerElevenLabsVoiceId: z.string().optional(),
});

export default function GenerationForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasKeys, setHasKeys] = useState(false);
  const [contentLength, setContentLength] = useState(0);
  
  // Vérification des clés API uniquement côté client
  useEffect(() => {
    setHasKeys(hasApiKeys());
  }, []);
  
  // Initialisation du formulaire
  const form = useForm<z.infer<typeof generationSchema>>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      contentType: 'text',
      content: '',
      length: 1000,
      style: 'conversational',
      firstSpeaker: 'Présentateur',
      secondSpeaker: 'Expert',
      podcastName: 'Mon Podcast',
      tagline: 'Un podcast généré par IA',
      language: 'fr',
      ttsModel: 'openai',
      creativity: 0.7,
      firstSpeakerVoice: 'nova',
      secondSpeakerVoice: 'echo',
      firstSpeakerElevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
      secondSpeakerElevenLabsVoiceId: 'ErXwobaYiN019PkySvjV', // Antoni
    },
  });

  // Soumission du formulaire
  const onSubmit = async (values: z.infer<typeof generationSchema>) => {
    try {
      // Vérifier si les clés API sont configurées
      if (!hasApiKeys()) {
        toast.error("Veuillez configurer les clés API dans l'onglet Configuration des API");
        return;
      }
      
      // Réinitialiser l'état
      setIsLoading(true);
      setProgress(0);
      setAudioUrl(null);
      
      // Récupérer les clés API
      const apiConfig = getApiKeys();
      
      // Préparer les paramètres de génération
      const source: ContentSource = {
        type: values.contentType,
        content: values.content,
      };
      
      const params: GenerationParams = {
        length: values.length,
        style: values.style,
        firstSpeaker: values.firstSpeaker,
        secondSpeaker: values.secondSpeaker,
        podcastName: values.podcastName,
        tagline: values.tagline || '',
        language: values.language,
        ttsModel: values.ttsModel,
        creativity: values.creativity,
        firstSpeakerVoice: values.firstSpeakerVoice,
        secondSpeakerVoice: values.secondSpeakerVoice,
        firstSpeakerElevenLabsVoiceId: values.firstSpeakerElevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM',
        secondSpeakerElevenLabsVoiceId: values.secondSpeakerElevenLabsVoiceId || 'ErXwobaYiN019PkySvjV',
      };
      
      // Simuler la progression
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 1000);
      
      // Appeler l'API de génération
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source,
          params,
          apiConfig,
        }),
      });
      
      // Arrêter la simulation de progression
      clearInterval(progressInterval);
      
      // Récupérer les données de la réponse
      const data = await response.json();
      
      // Vérifier la réponse
      if (!response.ok) {
        // Afficher le message d'erreur spécifique renvoyé par l'API
        const errorMessage = data.error || 'Erreur lors de la génération du podcast';
        toast.error(errorMessage);
        return;
      }
      
      // Mettre à jour l'état
      setProgress(100);
      setAudioUrl(data.audioUrl);
      
      // Vérifier si l'URL audio contient "sample-podcast.mp3"
      if (data.audioUrl && data.audioUrl.includes('sample-podcast.mp3')) {
        // Afficher un avertissement que l'audio d'exemple est utilisé
        toast.warning(
          `Un audio d'exemple est utilisé car le service ${params.ttsModel.toUpperCase()} n'a pas pu générer l'audio. Raisons possibles: quota dépassé, clé API invalide, ou service indisponible.`,
          { duration: 6000 }
        );
      } else {
        // Afficher un message de succès
        toast.success('Podcast généré avec succès !');
      }
    } catch (error) {
      console.error('Erreur lors de la génération du podcast:', error);
      toast.error('Erreur lors de la communication avec le serveur. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Générer un podcast</CardTitle>
        <CardDescription>
          Entrez le contenu source et les paramètres pour générer votre podcast.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasKeys ? (
          <div className="bg-yellow-100 p-4 rounded-md mb-4">
            <p className="text-yellow-800">
              Veuillez configurer au moins une clé API avant de générer un podcast.
            </p>
          </div>
        ) : null}
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Source de contenu */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Source de contenu</h3>
              
              <FormField
                control={form.control}
                name="contentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de contenu</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un type de contenu" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="text">Texte</SelectItem>
                        <SelectItem value="url">URL</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contenu</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Entrez le contenu à transformer en podcast..."
                        className="min-h-[200px]"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          // Mettre à jour le compteur de caractères
                          setContentLength(e.target.value.length);
                        }}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <div className="flex justify-between">
                      <FormDescription>
                        Entrez le contenu que vous souhaitez transformer en podcast.
                      </FormDescription>
                      <div className={`text-sm ${contentLength > 8000 ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                        {contentLength} / 8000 caractères
                        {contentLength > 8000 && (
                          <span className="ml-2">
                            (Le texte sera tronqué à 8000 caractères)
                          </span>
                        )}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Paramètres basiques */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Paramètres basiques</h3>
              
              <FormField
                control={form.control}
                name="length"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longueur (mots)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Slider
                          min={500}
                          max={5000}
                          step={100}
                          value={[field.value]}
                          onValueChange={([value]) => field.onChange(value)}
                          disabled={isLoading}
                        />
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>500</span>
                          <span>{field.value}</span>
                          <span>5000</span>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Langue</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une langue" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="en">Anglais</SelectItem>
                        <SelectItem value="es">Espagnol</SelectItem>
                        <SelectItem value="de">Allemand</SelectItem>
                        <SelectItem value="it">Italien</SelectItem>
                        <SelectItem value="pt">Portugais</SelectItem>
                        <SelectItem value="nl">Néerlandais</SelectItem>
                        <SelectItem value="ru">Russe</SelectItem>
                        <SelectItem value="zh">Chinois</SelectItem>
                        <SelectItem value="ja">Japonais</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Langue dans laquelle le podcast sera généré.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="style"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Style de conversation</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="conversational">Conversationnel</SelectItem>
                        <SelectItem value="debate">Débat</SelectItem>
                        <SelectItem value="interview">Interview</SelectItem>
                        <SelectItem value="educational">Éducatif</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstSpeaker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Premier intervenant</FormLabel>
                      <FormControl>
                        <Input placeholder="Présentateur" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="secondSpeaker"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Second intervenant</FormLabel>
                      <FormControl>
                        <Input placeholder="Expert" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="podcastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du podcast</FormLabel>
                      <FormControl>
                        <Input placeholder="Mon Podcast" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="tagline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tagline (optionnel)</FormLabel>
                      <FormControl>
                        <Input placeholder="Un podcast généré par IA" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Paramètres avancés */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Paramètres avancés</h3>
              
              <FormField
                control={form.control}
                name="ttsModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modèle Text-to-Speech</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un modèle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                        <SelectItem value="edge">Microsoft Edge</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="creativity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Niveau de créativité</FormLabel>
                    <FormControl>
                      <Slider
                        min={0}
                        max={1}
                        step={0.1}
                        defaultValue={[field.value]}
                        onValueChange={(value) => field.onChange(value[0])}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Ajustez le niveau de créativité du contenu généré.
                    </FormDescription>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="firstSpeakerVoice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voix du premier intervenant</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading || form.watch('ttsModel') !== 'openai'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une voix" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy (neutre)</SelectItem>
                        <SelectItem value="echo">Echo (masculine grave)</SelectItem>
                        <SelectItem value="fable">Fable (féminine douce)</SelectItem>
                        <SelectItem value="onyx">Onyx (masculine profonde)</SelectItem>
                        <SelectItem value="nova">Nova (féminine énergique)</SelectItem>
                        <SelectItem value="shimmer">Shimmer (féminine claire)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Voix utilisée pour le premier intervenant (uniquement pour OpenAI).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secondSpeakerVoice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voix du second intervenant</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading || form.watch('ttsModel') !== 'openai'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une voix" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy (neutre)</SelectItem>
                        <SelectItem value="echo">Echo (masculine grave)</SelectItem>
                        <SelectItem value="fable">Fable (féminine douce)</SelectItem>
                        <SelectItem value="onyx">Onyx (masculine profonde)</SelectItem>
                        <SelectItem value="nova">Nova (féminine énergique)</SelectItem>
                        <SelectItem value="shimmer">Shimmer (féminine claire)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Voix utilisée pour le second intervenant (uniquement pour OpenAI).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="firstSpeakerElevenLabsVoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voix ElevenLabs du premier intervenant</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading || form.watch('ttsModel') !== 'elevenlabs'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une voix" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ELEVENLABS_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} ({voice.description})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Voix utilisée pour le premier intervenant (uniquement pour ElevenLabs).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secondSpeakerElevenLabsVoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voix ElevenLabs du second intervenant</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isLoading || form.watch('ttsModel') !== 'elevenlabs'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez une voix" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ELEVENLABS_VOICES.map((voice) => (
                          <SelectItem key={voice.id} value={voice.id}>
                            {voice.name} ({voice.description})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Voix utilisée pour le second intervenant (uniquement pour ElevenLabs).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Bouton de génération */}
            <Button type="submit" className="w-full" disabled={isLoading || !hasKeys}>
              {isLoading ? 'Génération en cours...' : 'Générer le podcast'}
            </Button>
            
            {/* Barre de progression */}
            {isLoading && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-center text-gray-500">
                  {progress < 100 ? 'Génération en cours...' : 'Finalisation...'}
                </p>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
      
      {/* Lecteur audio - déplacé en dehors du formulaire */}
      {audioUrl && (
        <div className="mt-6">
          <AudioPlayer 
            title={`${form.watch('podcastName')} - Épisode généré`}
            audioUrl={audioUrl}
          />
        </div>
      )}
    </Card>
  );
} 