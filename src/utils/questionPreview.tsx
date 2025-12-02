import { Badge } from '@/components/ui/badge'
import type { Question, SpellingQuestion } from '@/types/models'

/**
 * Render question preview based on question type
 * Moved to separate file to fix Fast Refresh issue
 */
export function renderQuestionPreview(question: Question) {
  switch (question.type) {
    case 'fill-in':
      return (
        <div className="space-y-2">
          <p className="font-medium text-foreground">Sentence</p>
          <p>{question.prompt || (question as any).sentence || ''}</p>
          <p className="font-medium text-foreground">Answers</p>
          <div className="flex flex-wrap gap-2">
            {question.blanks.map((blank) => (
              <Badge key={blank.id} variant="secondary">
                {blank.answer}
              </Badge>
            ))}
          </div>
        </div>
      )
    case 'spelling': {
      // Handle both array format and single answer (backward compatibility)
      const questionWithAnswer = question as SpellingQuestion & { answer?: string }
      const spellingAnswers = Array.isArray(question.answers)
        ? question.answers
        : questionWithAnswer.answer
          ? [questionWithAnswer.answer]
          : []
      return (
        <div className="space-y-2">
          <p className="font-medium text-foreground">Correct Answers:</p>
          <div className="flex flex-wrap gap-2">
            {spellingAnswers.map((answer, index) => (
              <Badge key={index} variant="secondary">
                {answer}
              </Badge>
            ))}
          </div>
        </div>
      )
    }
    case 'matching': {
      // Handle both array format (teacher panel) and object format (student app/Firestore)
      const pairsArray = Array.isArray(question.pairs)
        ? question.pairs
        : question.pairs && typeof question.pairs === 'object'
          ? Object.entries(question.pairs).map(([left, right]) => ({
              id: left,
              left,
              right: right as string,
            }))
          : []
      return (
        <div className="grid gap-2">
          {pairsArray.map((pair) => (
            <div key={pair.id || pair.left} className="grid grid-cols-2 gap-3 rounded-lg border border-border p-2">
              <span>{pair.left}</span>
              <span className="font-semibold text-foreground">{pair.right}</span>
            </div>
          ))}
        </div>
      )
    }
    case 'order-words':
      return (
        <div className="space-y-2">
          <p className="font-medium text-foreground">Correct Answer:</p>
          <p className="text-foreground">{question.correctOrder.join(' ')}</p>
        </div>
      )
    default:
      return null
  }
}

