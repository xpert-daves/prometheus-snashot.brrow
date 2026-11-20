import { render, screen } from '@testing-library/react'
import { invalidate } from '@react-three/fiber'
import React from 'react'
import * as THREE from 'three'
import StructurePreview from '../StructurePreview'
import { getLogoTexture } from '../structure-preview/textures'

// Installed before any render so the logo singleton's first load is recorded.
const textureLoadSpy = jest.spyOn(THREE.TextureLoader.prototype, 'load')

jest.mock('react/jsx-runtime', () => {
  const actual = jest.requireActual('react/jsx-runtime')
  const htmlTags = new Set([
    'a',
    'button',
    'canvas',
    'dd',
    'div',
    'dl',
    'dt',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'p',
    'path',
    'section',
    'small',
    'span',
    'strong',
    'svg',
    'ul',
  ])

  const normalize = (type: unknown, props: Record<string, unknown> | null | undefined) =>
    typeof type === 'string' && !htmlTags.has(type)
      ? { type: actual.Fragment, props: { children: props?.children } }
      : { type, props }

  const jsxDEV = actual.jsxDEV
    ? function jsxDEV(
        type: unknown,
        props: Record<string, unknown> | null | undefined,
        key: string,
        isStaticChildren: boolean,
        source: unknown,
        self: unknown,
      ) {
        const normalized = normalize(type, props)
        return actual.jsxDEV(
          normalized.type,
          normalized.props,
          key,
          isStaticChildren,
          source,
          self,
        )
      }
    : undefined

  return {
    ...actual,
    jsx: (type: unknown, props: Record<string, unknown> | null | undefined, key: string) => {
      const normalized = normalize(type, props)
      return actual.jsx(normalized.type, normalized.props, key)
    },
    jsxs: (type: unknown, props: Record<string, unknown> | null | undefined, key: string) => {
      const normalized = normalize(type, props)
      return actual.jsxs(normalized.type, normalized.props, key)
    },
    jsxDEV,
  }
})

jest.mock('@react-three/fiber', () => ({
  // The preview renders on demand; async textures and the scene request frames.
  invalidate: jest.fn(),
  useFrame: jest.fn(),
  useThree: jest.fn((selector?: (state: { invalidate: () => void }) => unknown) => {
    const state = { invalidate: jest.fn() }
    return selector ? selector(state) : state
  }),
  Canvas: ({
    children,
    className,
    frameloop,
    style,
    'data-testid': dataTestId,
  }: {
    children: React.ReactNode
    className?: string
    frameloop?: string
    style?: React.CSSProperties
    'data-testid'?: string
  }) => (
    <div className={className} data-frameloop={frameloop} data-testid={dataTestId} style={style}>
      {children}
    </div>
  )
}))

jest.mock('@react-three/drei', () => {
  const PassThrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    OrbitControls: ({
      maxDistance,
      enabled,
      autoRotate,
    }: {
      maxDistance?: number
      enabled?: boolean
      autoRotate?: boolean
    }) => (
      <div
        data-auto-rotate={String(autoRotate)}
        data-enabled={String(enabled)}
        data-max-distance={maxDistance}
        data-testid="orbit-controls"
      />
    ),
    Environment: PassThrough,
    ContactShadows: () => null,
    Html: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Line: PassThrough,
    Bounds: PassThrough,
    Lightformer: () => null,
    Grid: () => null
  }
})

jest.mock('lucide-react', () => ({
  DoorOpen: () => <span data-icon="door" />,
  PanelsTopLeft: () => <span data-icon="roof" />,
  Plus: () => <span data-icon="plus" />,
  Ruler: () => <span data-icon="ruler" />,
  Sparkles: () => <span data-icon="sparkles" />,
  Trash2: () => <span data-icon="trash" />,
  AppWindow: () => <span data-icon="window" />
}))

describe('StructurePreview', () => {
  it('uses 6-foot walls when preview params omit wall height', () => {
    render(
      <StructurePreview
        params={{
          structureType: 'storage_shed',
          length: 10,
          width: 10,
          deliveryRadius: 0,
          showDimensions: true,
        }}
      />
    )

    expect(screen.getByText(/footprint - 6' 0" walls/)).toBeInTheDocument()
    expect(screen.getByText('Wall 6\' 0"')).toBeInTheDocument()
  })

  it('disposes structure geometry on param change', () => {
    const disposeSpy = jest.spyOn(THREE.BufferGeometry.prototype, 'dispose')
    const initial = {
      structureType: 'storage_shed' as const,
      length: 10,
      width: 10,
      deliveryRadius: 0
    }

    const { rerender } = render(<StructurePreview params={initial} />)

    const updated = { ...initial, length: 12 }
    rerender(<StructurePreview params={updated} />)

    expect(disposeSpy).toHaveBeenCalled()
    disposeSpy.mockRestore()
  })

  it.each(['carport', 'open_loafing', 'greenhouse'] as const)(
    'renders %s through the metal-building model without crashing',
    (structureType) => {
      const params = {
        structureType,
        length: 20,
        width: 12,
        roofStyle: 'gabled' as const,
        wallHeight: 7 as const,
        deliveryRadius: 0
      }

      const { rerender } = render(<StructurePreview params={params} />)
      rerender(<StructurePreview params={{ ...params, roofStyle: 'lean-to' }} />)

      expect(screen.getByTestId('structure-canvas')).toBeInTheDocument()
    }
  )

  it('syncs read-only feature props and hides editing controls', () => {
    const initial = {
      structureType: 'storage_shed' as const,
      length: 12,
      width: 8,
      roofStyle: 'gabled' as const,
      wallHeight: 7 as const,
      deliveryRadius: 0,
      doors: [
        {
          id: 'door-default-single_shed',
          side: 'front' as const,
          width: 3,
          height: 6.75,
          offset: 0,
          placement: 'default' as const,
        },
      ],
      windows: [
        {
          id: 'window-default-1',
          side: 'right' as const,
          width: 2,
          height: 3,
          offset: 0,
          heightFromFloor: 3,
          placement: 'default' as const,
        },
      ],
    }

    const { rerender } = render(<StructurePreview params={initial} editMode={false} />)

    // In read-only mode the info/controls overlay is fully hidden — the host
    // page renders its own selection summary instead.
    expect(screen.queryByText('Add')).not.toBeInTheDocument()
    expect(screen.queryByText(/Delete selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Drag doors and windows/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No feature selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText('doors')).not.toBeInTheDocument()
    expect(screen.queryByText('windows')).not.toBeInTheDocument()
    expect(screen.queryByText('Gable roof')).not.toBeInTheDocument()
    const preview = screen.getByRole('img', {
      name: /storage shed 3D preview: 12' 0" by 8' 0" footprint, 7' 0" walls, Gable roof/i,
    })
    expect(preview).toBeInTheDocument()
    // Shorter on phones; the quote page's loading placeholder matches these heights.
    expect(preview).toHaveClass('h-64', 'sm:h-80', 'md:h-[28rem]')
    expect(Number(screen.getByTestId('orbit-controls').getAttribute('data-max-distance'))).toBeLessThan(9)
    expect(screen.getByTestId('orbit-controls')).toHaveAttribute('data-enabled', 'false')
    expect(screen.getByTestId('orbit-controls')).toHaveAttribute('data-auto-rotate', 'false')
    // Touches fall through the view-only canvas so swipes scroll the page, and
    // the static scene only renders when something changes.
    expect(screen.getByTestId('structure-canvas')).toHaveStyle({ pointerEvents: 'none' })
    expect(screen.getByTestId('structure-canvas')).toHaveAttribute('data-frameloop', 'demand')

    rerender(
      <StructurePreview
        params={{
          ...initial,
          roofStyle: 'barn',
          doors: [],
          windows: [
            ...initial.windows,
            {
              id: 'window-default-2',
              side: 'left',
              width: 2,
              height: 3,
              offset: 0,
              heightFromFloor: 3,
              placement: 'default',
            },
          ],
        }}
        editMode={false}
      />
    )

    expect(screen.queryByText('doors')).not.toBeInTheDocument()
    expect(screen.queryByText('Gambrel roof')).not.toBeInTheDocument()
  })

  it('shows the overlay with counts when feature controls are enabled', () => {
    render(
      <StructurePreview
        params={{
          structureType: 'storage_shed',
          length: 12,
          width: 8,
          roofStyle: 'gabled',
          wallHeight: 7,
          deliveryRadius: 0,
          doors: [
            {
              id: 'door-default-single_shed',
              side: 'front',
              width: 3,
              height: 6.75,
              offset: 0,
            },
          ],
          windows: [],
        }}
        editMode
        showFeatureControls
      />
    )

    expect(screen.getByText('doors').parentElement).toHaveTextContent('1doors')
    expect(screen.getByText('windows').parentElement).toHaveTextContent('0windows')
    expect(screen.getByText('Gable roof')).toBeInTheDocument()
    expect(screen.getByText(/Drag doors and windows/i)).toBeInTheDocument()
    expect(screen.getByTestId('structure-canvas')).toHaveStyle({ pointerEvents: 'auto' })
    expect(screen.getByTestId('structure-canvas')).toHaveAttribute('data-frameloop', 'demand')
  })

  it('keeps drag mode while hiding full feature controls', () => {
    render(
      <StructurePreview
        params={{
          structureType: 'storage_shed',
          length: 12,
          width: 8,
          roofStyle: 'gabled',
          wallHeight: 7,
          deliveryRadius: 0,
          doors: [
            {
              id: 'door-default-single_shed',
              side: 'front',
              width: 3,
              height: 6.75,
              offset: 0,
            },
          ],
          windows: [],
        }}
        editMode
        showFeatureControls={false}
      />
    )

    expect(screen.queryByText('Add')).not.toBeInTheDocument()
    expect(screen.queryByText(/Delete selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No feature selected/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Drag doors and windows/i)).not.toBeInTheDocument()
  })

  it('requests a frame when a feature is removed from the on-demand scene', () => {
    const window1 = {
      id: 'window-default-1',
      side: 'right' as const,
      width: 2,
      height: 3,
      offset: 0,
      heightFromFloor: 3,
      placement: 'default' as const,
    }
    const params = {
      structureType: 'open_loafing' as const,
      length: 12,
      width: 10,
      deliveryRadius: 0,
      doors: [],
      windows: [window1],
    }
    const { rerender } = render(
      <StructurePreview params={params} editMode={false} syncFeaturesFromProps />
    )

    jest.mocked(invalidate).mockClear()
    rerender(
      <StructurePreview params={{ ...params, windows: [] }} editMode={false} syncFeaturesFromProps />
    )

    expect(invalidate).toHaveBeenCalled()
  })

  it('requests a frame once the logo texture finishes loading', () => {
    getLogoTexture()
    const logoLoad = textureLoadSpy.mock.calls.find(([url]) => url.startsWith('data:image/'))
    const onLoad = logoLoad?.[1]
    expect(onLoad).toEqual(expect.any(Function))

    jest.mocked(invalidate).mockClear()
    onLoad?.(new THREE.Texture())
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})
