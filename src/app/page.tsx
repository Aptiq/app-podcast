import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ApiConfigForm from "@/components/podcast/api-config-form";
import GenerationForm from "@/components/podcast/generation-form";

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Podcast Generator</h1>
        <p className="text-xl text-gray-600">
          Générez des podcasts à partir de contenus variés en utilisant l'IA
        </p>
      </div>

      <Tabs defaultValue="generate" className="max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generate">Générer un podcast</TabsTrigger>
          <TabsTrigger value="config">Configuration des API</TabsTrigger>
        </TabsList>
        <TabsContent value="generate" className="mt-6">
          <GenerationForm />
        </TabsContent>
        <TabsContent value="config" className="mt-6">
          <ApiConfigForm />
        </TabsContent>
      </Tabs>
    </main>
  );
}
