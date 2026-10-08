"use client"

import { useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import { fieldClass, primaryButtonClass, secondaryButtonClass, surfaceClass } from "@/components/quiz-shell"

export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "IDENTIFICATION"

export type QuizQuestion = {
  id: string
  type: QuestionType
  questionText: string
  options: string[]
  correctOptions: number[]
  acceptedAnswers: string[]
  points: number
  timeLimitSec: number
}

export type QuizRound = {
  id: string
  title: string
  questions: QuizQuestion[]
}

export type SavedQuiz = {
  id: string
  title: string
  description: string
  rounds: QuizRound[]
  updatedAt: string
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createQuestion(): QuizQuestion {
  return {
    id: createId(),
    type: "MULTIPLE_CHOICE",
    questionText: "",
    options: ["", "", "", ""],
    correctOptions: [],
    acceptedAnswers: [],
    points: 100,
    timeLimitSec: 30,
  }
}

function createRound(number: number): QuizRound {
  return { id: createId(), title: `Round ${number}`, questions: [createQuestion()] }
}

export function QuizBuilder({ quiz, onCancel, onSave }: { quiz?: SavedQuiz; onCancel: () => void; onSave: (quiz: SavedQuiz) => void | Promise<void> }) {
  const [title, setTitle] = useState(quiz?.title ?? "")
  const [description, setDescription] = useState(quiz?.description ?? "")
  const [rounds, setRounds] = useState(quiz?.rounds ?? [createRound(1)])
  const [activeRoundId, setActiveRoundId] = useState(rounds[0].id)
  const [error, setError] = useState("")
  const activeRound = rounds.find((round) => round.id === activeRoundId) ?? rounds[0]

  function updateRound(roundId: string, update: (round: QuizRound) => QuizRound) {
    setRounds((current) => current.map((round) => round.id === roundId ? update(round) : round))
  }

  function updateQuestion(questionId: string, update: (question: QuizQuestion) => QuizQuestion) {
    updateRound(activeRound.id, (round) => ({
      ...round,
      questions: round.questions.map((question) => question.id === questionId ? update(question) : question),
    }))
  }

  function addRound() {
    const round = createRound(rounds.length + 1)
    setRounds((current) => [...current, round])
    setActiveRoundId(round.id)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const hasIncompleteQuestion = rounds.some((round) => round.questions.some((question) => {
      if (!question.questionText.trim()) return true
      if (question.type === "MULTIPLE_CHOICE") {
        const validOptions = question.options.map((option, index) => option.trim() ? index : -1).filter((index) => index >= 0)
        return validOptions.length < 2 || !question.correctOptions.some((index) => validOptions.includes(index))
      }
      if (question.type === "IDENTIFICATION") return question.acceptedAnswers.length === 0
      return question.correctOptions.length !== 1
    }))

    if (hasIncompleteQuestion) {
      setError("Complete each question and mark its correct answer before saving.")
      return
    }

    onSave({
      id: quiz?.id ?? createId(),
      title: title.trim(),
      description: description.trim(),
      rounds,
      updatedAt: new Date().toISOString(),
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#62e8cb]">Quiz editor</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">{quiz ? "Edit quiz" : "Create a quiz"}</h2>
        </div>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>Cancel</button>
      </div>

      <section className={`${surfaceClass} grid gap-4 p-5 sm:grid-cols-2 sm:p-6`}>
        <label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Quiz title
          <input className={fieldClass} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Product thinking" required />
        </label>
        <label className="flex flex-col gap-2 text-xs font-semibold text-white/65">Description <span className="text-[10px] font-normal text-white/35">Optional</span>
          <input className={fieldClass} maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will players explore?" />
        </label>
      </section>

      <section className={`${surfaceClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
          <div><h3 className="text-sm font-bold text-white">Rounds and questions</h3><p className="mt-1 text-xs text-white/40">{rounds.length} rounds · {rounds.reduce((total, round) => total + round.questions.length, 0)} questions</p></div>
          <button type="button" onClick={addRound} className={secondaryButtonClass}><Plus className="size-4" /> Add round</button>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-white/[0.07] px-5 py-3 sm:px-6">
          {rounds.map((round, index) => <button key={round.id} type="button" onClick={() => setActiveRoundId(round.id)} className={`shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold transition ${round.id === activeRound.id ? "border-[#10d7ac]/35 bg-[#10d7ac]/[0.09] text-[#72edce]" : "border-white/[0.08] text-white/45 hover:text-white"}`}>{round.title || `Round ${index + 1}`}</button>)}
        </div>
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="round-title">Round title</label>
            <input id="round-title" className={`${fieldClass} max-w-sm`} value={activeRound.title} onChange={(event) => updateRound(activeRound.id, (round) => ({ ...round, title: event.target.value }))} aria-label="Round title" />
            {rounds.length > 1 && <button type="button" aria-label={`Delete ${activeRound.title}`} onClick={() => {
              const nextRounds = rounds.filter((round) => round.id !== activeRound.id)
              setRounds(nextRounds)
              setActiveRoundId(nextRounds[0].id)
            }} className="inline-flex size-11 items-center justify-center rounded-xl border border-[#fa718d]/20 text-[#ffa0b1] transition hover:bg-[#fa718d]/10"><Trash2 className="size-4" /></button>}
          </div>

          {activeRound.questions.map((question, questionIndex) => <article key={question.id} className="rounded-xl border border-white/[0.08] bg-black/[0.12] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><h4 className="text-xs font-bold uppercase tracking-[0.12em] text-white/50">Question {questionIndex + 1}</h4>
              {activeRound.questions.length > 1 && <button type="button" aria-label={`Delete question ${questionIndex + 1}`} onClick={() => updateRound(activeRound.id, (round) => ({ ...round, questions: round.questions.filter((item) => item.id !== question.id) }))} className="inline-flex size-9 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-[#ffa0b1]"><Trash2 className="size-4" /></button>}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <label className="flex flex-col gap-2 text-xs font-semibold text-white/60">Question
                <textarea className={`${fieldClass} min-h-20 resize-y py-3`} maxLength={500} value={question.questionText} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, questionText: event.target.value }))} placeholder="Write your question" />
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                <label className="flex flex-col gap-2 text-xs font-semibold text-white/60">Type
                  <select className={fieldClass} value={question.type} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, type: event.target.value as QuestionType, options: event.target.value === "TRUE_FALSE" ? ["True", "False"] : event.target.value === "MULTIPLE_CHOICE" ? ["", "", "", ""] : [], correctOptions: [], acceptedAnswers: [] }))}>
                    <option value="MULTIPLE_CHOICE">Multiple choice</option><option value="TRUE_FALSE">True or false</option><option value="IDENTIFICATION">Identification</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold text-white/60">Points
                  <input className={fieldClass} type="number" min={1} max={10000} step={1} value={question.points} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, points: Number(event.target.value) }))} />
                </label>
                <label className="col-span-2 flex flex-col gap-2 text-xs font-semibold text-white/60 sm:col-span-1">Time limit
                  <select className={fieldClass} value={question.timeLimitSec} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, timeLimitSec: Number(event.target.value) }))}>{[10, 15, 30, 60].map((seconds) => <option key={seconds} value={seconds}>{seconds} seconds</option>)}</select>
                </label>
              </div>
            </div>

            {question.type === "IDENTIFICATION" ? <label className="mt-4 flex flex-col gap-2 text-xs font-semibold text-white/60">Accepted answers <span className="text-[10px] font-normal text-white/35">Separate alternatives with commas. Matching ignores case and surrounding spaces.</span>
              <input className={fieldClass} value={question.acceptedAnswers.join(", ")} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, acceptedAnswers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean) }))} placeholder="e.g. machine learning, ML" />
            </label> : <fieldset className="mt-4"><legend className="mb-2 text-xs font-semibold text-white/60">{question.type === "TRUE_FALSE" ? "Correct answer" : "Answer choices · select every correct answer"}</legend><div className="grid gap-2 sm:grid-cols-2">
              {question.options.map((option, optionIndex) => <label key={`${question.id}-${optionIndex}`} className="flex min-h-11 items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3">
                <input type={question.type === "TRUE_FALSE" ? "radio" : "checkbox"} name={`correct-${question.id}`} checked={question.correctOptions.includes(optionIndex)} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, correctOptions: question.type === "TRUE_FALSE" ? [optionIndex] : event.target.checked ? [...item.correctOptions, optionIndex] : item.correctOptions.filter((index) => index !== optionIndex) }))} />
                {question.type === "MULTIPLE_CHOICE" ? <input className="min-w-0 flex-1 bg-transparent py-2 text-xs text-white outline-none placeholder:text-white/25" maxLength={120} value={option} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, options: item.options.map((value, index) => index === optionIndex ? event.target.value : value) }))} placeholder={`Choice ${optionIndex + 1}`} /> : <span className="text-xs text-white/75">{option}</span>}
              </label>)}
            </div></fieldset>}
          </article>)}
          <button type="button" onClick={() => updateRound(activeRound.id, (round) => ({ ...round, questions: [...round.questions, createQuestion()] }))} className={`${secondaryButtonClass} w-full`}><Plus className="size-4" /> Add question</button>
        </div>
      </section>

      <div className="flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <p role="alert" className="min-h-5 text-xs text-[#ffa0b1]">{error}</p>
        <button type="submit" className={primaryButtonClass}>Save quiz</button>
      </div>
    </form>
  )
}