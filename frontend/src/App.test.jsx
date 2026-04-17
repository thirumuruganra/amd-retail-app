import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const successfulPayload = {
  sentiment: 'Negative',
  confidence_score: 0.92,
  category: 'Shipping',
  department: 'Logistics',
  detected_language: 'Spanish',
  reply_draft: 'Lamentamos el retraso y el estado del pedido.',
  summary: 'Customer reports late delivery and damaged packaging.',
}

describe('App', () => {
  afterEach(() => {
    global.fetch = undefined
  })

  it('shows an error when submitting with empty input', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /analyze review/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /paste a customer review/i,
    )
  })

  it('renders analyzed values after a successful request', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successfulPayload,
    })

    render(<App />)

    fireEvent.change(screen.getByLabelText(/customer review/i), {
      target: { value: 'The product arrived late and box was damaged.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /analyze review/i }))

    expect(await screen.findByText('Shipping')).toBeInTheDocument()
    expect(screen.getByText('Logistics')).toBeInTheDocument()
    expect(screen.getByText('Negative')).toBeInTheDocument()
    expect(screen.getByText('92%')).toBeInTheDocument()
  })

  it('shows loading state while request is in progress', async () => {
    let resolveRequest
    const pendingRequest = new Promise((resolve) => {
      resolveRequest = resolve
    })

    global.fetch = vi.fn().mockReturnValue(pendingRequest)

    render(<App />)

    fireEvent.change(screen.getByLabelText(/customer review/i), {
      target: { value: 'Please analyze this review.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /analyze review/i }))

    expect(screen.getByRole('button', { name: /analyzing.../i })).toBeDisabled()

    resolveRequest({
      ok: true,
      json: async () => successfulPayload,
    })

    await screen.findByText('Negative')
  })

  it('renders API error message when request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Gemini API unavailable.' }),
    })

    render(<App />)

    fireEvent.change(screen.getByLabelText(/customer review/i), {
      target: { value: 'The website checkout failed repeatedly.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /analyze review/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /gemini api unavailable/i,
    )
  })

  it('resets the form and clears rendered analysis', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => successfulPayload,
    })

    render(<App />)

    const textarea = screen.getByLabelText(/customer review/i)
    fireEvent.change(textarea, {
      target: { value: 'Delivery was delayed for 5 days.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /analyze review/i }))

    await screen.findByText('Shipping')

    fireEvent.click(screen.getByRole('button', { name: /reset/i }))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
    expect(screen.queryByText('Shipping')).not.toBeInTheDocument()
    expect(screen.getByText('Neutral')).toBeInTheDocument()
  })
})
