"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getApiKeys, saveApiKeys, ApiConfig } from '@/lib/api-config';
import { toast } from 'sonner';

// Schéma de validation pour le formulaire
const apiConfigSchema = z.object({
  openai: z.string().optional(),
  gemini: z.string().optional(),
  elevenlabs: z.string().optional(),
}).refine(data => data.openai || data.gemini || data.elevenlabs, {
  message: "Au moins une clé API doit être fournie",
  path: ["openai"],
});

export default function ApiConfigForm() {
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialisation du formulaire
  const form = useForm<z.infer<typeof apiConfigSchema>>({
    resolver: zodResolver(apiConfigSchema),
    defaultValues: {
      openai: '',
      gemini: '',
      elevenlabs: '',
    },
  });

  // Chargement des clés API existantes
  useEffect(() => {
    const keys = getApiKeys();
    form.reset(keys);
  }, [form]);

  // Soumission du formulaire
  const onSubmit = async (values: z.infer<typeof apiConfigSchema>) => {
    setIsLoading(true);
    try {
      // Sauvegarde des clés API
      saveApiKeys(values);
      toast.success('Configuration des API sauvegardée');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des clés API:', error);
      toast.error('Erreur lors de la sauvegarde des clés API');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Configuration des API</CardTitle>
        <CardDescription>
          Entrez vos clés API pour utiliser le générateur de podcasts.
          Au moins une clé est nécessaire.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="openai"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clé API OpenAI</FormLabel>
                  <FormControl>
                    <Input placeholder="sk-..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Utilisée pour la génération de texte et la synthèse vocale.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="gemini"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clé API Google Gemini</FormLabel>
                  <FormControl>
                    <Input placeholder="AIza..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Alternative à OpenAI pour la génération de texte.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="elevenlabs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clé API ElevenLabs</FormLabel>
                  <FormControl>
                    <Input placeholder="..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Pour une synthèse vocale de haute qualité.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Sauvegarde en cours...' : 'Sauvegarder'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
} 