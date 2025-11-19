import { type FormEvent, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import OpenAI from "openai"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-5-mini"

const SYSTEM_PROMPT = `You are the Vienna Building Development Assistant embedded in AEC-2.
- Focus on Vienna's building potential, zoning regulations, and development opportunities.
- Reference Austrian/Vienna building codes (MA 21, Bauordnung) whenever relevant.
- Use the currently selected map context and parcel data to ground your reasoning.
- Highlight constraints, required permits, and practical next steps for developers.
- Call out assumptions explicitly and keep answers structured, concise, and action oriented.`

const AI_SUGGESTIONS = [
    "Can I add more floors to this building?",
    "What are the zoning restrictions?",
    "How do I get development permits?",
    "What's the maximum building height allowed?"
] as const

type AiChatMessage = {
    role: "user" | "assistant"
    content: string
}

type MarkerPosition = { longitude: number; latitude: number } | null

type AiCopilotPanelProps = {
    markerPosition: MarkerPosition
    propertyGeoJson: GeoJSON.FeatureCollection | null
}

export function AiCopilotPanel({
    markerPosition,
    propertyGeoJson,
}: AiCopilotPanelProps) {
    const [aiPrompt, setAiPrompt] = useState("")
    const [aiConversation, setAiConversation] = useState<AiChatMessage[]>([])
    const [aiStatus, setAiStatus] = useState<"idle" | "loading">("idle")
    const [aiError, setAiError] = useState<string | null>(null)

    const propertyContextSummary = useMemo(() => {
        const contextPieces: string[] = []

        if (markerPosition) {
            contextPieces.push(
                `Marker coordinates: latitude ${markerPosition.latitude.toFixed(6)}, longitude ${markerPosition.longitude.toFixed(6)}.`
            )
        }

        if (propertyGeoJson?.features?.length) {
            const [firstFeature] = propertyGeoJson.features
            const props = (firstFeature.properties ?? {}) as Record<string, unknown>
            contextPieces.push(`Property geometry type: ${firstFeature.geometry?.type ?? "unknown"}.`)
            contextPieces.push(`Feature count: ${propertyGeoJson.features.length}.`)

            const propertyHighlights = Object.entries(props)
                .filter(([_, value]) => typeof value === "string" || typeof value === "number")
                .slice(0, 6)
                .map(([key, value]) => `${key}: ${value}`)

            if (propertyHighlights.length) {
                contextPieces.push(`Key parcel data -> ${propertyHighlights.join(", ")}`)
            }
        }

        return contextPieces.length ? contextPieces.join("\n") : null
    }, [markerPosition, propertyGeoJson])

    const runOpenAiQuery = async (event?: FormEvent<HTMLFormElement>) => {
        event?.preventDefault()

        const trimmedPrompt = aiPrompt.trim()
        if (!trimmedPrompt) {
            setAiError("Please enter a prompt.")
            return
        }

        if (!OPENAI_API_KEY) {
            setAiError("Missing OpenAI API key. Add VITE_OPENAI_API_KEY to your .env file.")
            return
        }

        setAiStatus("loading")
        setAiError(null)

        const newUserMessage: AiChatMessage = {
            role: "user",
            content: trimmedPrompt,
        }

        // Optimistically update UI
        setAiConversation((prev) => [...prev, newUserMessage])
        setAiPrompt("")

        const recentHistory = aiConversation.slice(-6).map((message) => ({
            role: message.role,
            content: message.content,
        }))

        const userContentForApi = propertyContextSummary
            ? `${trimmedPrompt}\n\nContext to consider:\n${propertyContextSummary}`
            : trimmedPrompt

        const compiledInput = [
            `System instructions:\n${SYSTEM_PROMPT}`,
            ...recentHistory.map((message) =>
                `${message.role === "user" ? "User" : "Assistant"}:\n${message.content}`,
            ),
            `User:\n${userContentForApi}`,
        ]
            .filter(Boolean)
            .join("\n\n")

        try {
            const openai = new OpenAI({
                apiKey: OPENAI_API_KEY,
                dangerouslyAllowBrowser: true,
            })

            const response = await openai.responses.create({
                model: OPENAI_MODEL,
                input: compiledInput,
            })

            const outputSegments = Array.isArray(response.output)
                ? response.output.flatMap((segment: any) =>
                    Array.isArray(segment?.content)
                        ? segment.content
                            .filter((content: any) => content?.type === "output_text")
                            .map((content: any) => content?.text ?? "")
                        : [],
                )
                : []
            const assistantText =
                (outputSegments.join("\n").trim() ||
                    (Array.isArray((response as any)?.output_text) ? (response as any).output_text.join("\n").trim() : "")) ||
                "PropAI did not return any content. Try asking again."

            const assistantMessage: AiChatMessage = {
                role: "assistant",
                content: assistantText,
            }

            setAiConversation((prev) => [...prev, assistantMessage])
        } catch (error) {
            console.error("Failed to query OpenAI:", error)
            setAiError(error instanceof Error ? error.message : "Unknown error while querying OpenAI.")
        } finally {
            setAiStatus("idle")
        }
    }

    const handleClearConversation = () => {
        setAiConversation([])
        setAiPrompt("")
        setAiError(null)
    }

    return (
        <>
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight text-primary">PropAI</h2>
                    <p className="text-sm text-muted-foreground">
                        Your smart assistant for Vienna development.
                    </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                    {aiStatus === "loading" ? "Thinking..." : "Ready"}
                </span>
            </div>

            {!OPENAI_API_KEY && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    Add your OpenAI API key to <code>VITE_OPENAI_API_KEY</code> to enable queries.
                </div>
            )}

            <form onSubmit={runOpenAiQuery} className="space-y-3">
                <div className="space-y-2">
                    <Label htmlFor="ai-prompt" className="sr-only">Question or task</Label>
                    <Textarea
                        id="ai-prompt"
                        placeholder="Ask about zoning, building height, or permits..."
                        value={aiPrompt}
                        onChange={(event) => setAiPrompt(event.target.value)}
                        disabled={aiStatus === "loading"}
                        className="resize-none border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/50 shadow-none"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="submit"
                        variant="ghost"
                        disabled={!aiPrompt.trim() || aiStatus === "loading" || !OPENAI_API_KEY}
                        className="rounded-full "
                    >
                        {aiStatus === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Ask PropAI
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearConversation}
                        disabled={(aiConversation.length === 0 && !aiPrompt) || aiStatus === "loading"}
                        className="rounded-full"
                    >
                        Clear
                    </Button>
                </div>
            </form>

            {aiConversation.length === 0 && (
                <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Suggested prompts</Label>
                    <div className="flex flex-wrap gap-2">
                        {AI_SUGGESTIONS.map((suggestion) => (
                            <Button
                                key={suggestion}
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setAiPrompt(suggestion)}
                                disabled={aiStatus === "loading"}
                                className="text-xs"
                            >
                                {suggestion}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex flex-col flex-1 min-h-0 space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Conversation</Label>
                    <span className="text-xs text-muted-foreground">
                        {aiConversation.length ? `${aiConversation.length} messages` : ""}
                    </span>
                </div>
                <div className="flex-1 rounded-xl border-0 bg-muted/30 p-2">
                    <ScrollArea className="h-full pr-4">
                        {aiConversation.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center text-center text-sm text-muted-foreground p-4">
                                <p>No messages yet.</p>
                                <p className="text-xs mt-1">Start by asking a question above.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 py-2">
                                {aiConversation.map((message, index) => (
                                    <div
                                        key={`${message.role}-${index}`}
                                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${message.role === "user"
                                            ? "bg-primary text-primary-foreground ml-8 rounded-br-none"
                                            : "bg-background text-foreground mr-8 rounded-bl-none"
                                            }`}
                                    >
                                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
                                            {message.role === "user" ? "You" : "PropAI"}
                                        </p>
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>

            {aiError && <p className="text-sm text-destructive">{aiError}</p>}

            {propertyContextSummary && (
                <div className="rounded-xl bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground mb-1">Active Context</p>
                    <p className="whitespace-pre-wrap leading-relaxed opacity-80">{propertyContextSummary}</p>
                </div>
            )}
        </>
    )
}

