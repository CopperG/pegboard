import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TextPanel } from '@/components/panels/TextPanel'

describe('TextPanel', () => {
  it('wraps content in a scrollable container', () => {
    const { container } = render(
      <TextPanel
        panelId="p1"
        size="md"
        data={{ summary: 's', content: 'long\n'.repeat(200), format: 'plaintext' }}
      />,
    )
    expect(container.querySelector('.overflow-y-auto')).not.toBeNull()
  })
})
