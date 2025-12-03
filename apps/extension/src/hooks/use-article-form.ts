import { useState, useEffect } from 'react'
import { Priority, CheckArticleSavedResponse } from '@readspace/shared'

export function useArticleForm(savedArticle: CheckArticleSavedResponse | null) {
    const [form, setForm] = useState({
        title: '',
        note: '',
        priority: 'LOW' as Priority,
    })

    const [originalForm, setOriginalForm] = useState({
        title: '',
        note: '',
        priority: 'LOW' as Priority,
    })

    useEffect(() => {
        if (savedArticle && savedArticle.is_saved) {
            const newState = {
                title: savedArticle.title || '',
                note: savedArticle.note || '',
                priority: (savedArticle.priority || 'LOW') as Priority,
            }
            setForm(newState)
            setOriginalForm(newState)
        } else {
            const defaultState = { title: '', note: '', priority: 'LOW' as Priority }
            setForm(defaultState)
            setOriginalForm(defaultState)
        }
    }, [savedArticle])

    const hasUnsavedChanges =
        !!savedArticle &&
        (form.title !== originalForm.title ||
            form.note !== originalForm.note ||
            form.priority !== originalForm.priority)

    return { form, setForm, hasUnsavedChanges }
}
