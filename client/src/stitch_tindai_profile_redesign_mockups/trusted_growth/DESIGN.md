---
name: Trusted Growth
colors:
  surface: '#F8F9FF'
  surface-dim: '#CBDBF5'
  surface-bright: '#f7faf7'
  surface-container-lowest: '#FFFFFF'
  surface-container-low: '#EFF4FF'
  surface-container: '#E5EEFF'
  surface-container-high: '#DCE9FF'
  surface-container-highest: '#D3E4FE'
  on-surface: '#0B1C30'
  on-surface-variant: '#3e4945'
  inverse-surface: '#2d312f'
  inverse-on-surface: '#eef2ee'
  outline: '#6E7A74'
  outline-variant: '#bec9c3'
  surface-tint: '#016b55'
  primary: '#00604c'
  on-primary: '#ffffff'
  primary-container: '#1F7A63'
  on-primary-container: '#B1FFE4'
  inverse-primary: '#82d6bb'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d3e3ff'
  on-secondary-container: '#56657d'
  tertiary: '#45566b'
  on-tertiary: '#ffffff'
  tertiary-container: '#5e6e84'
  on-tertiary-container: '#e8f0ff'
  error: '#BA1A1A'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9ef3d7'
  primary-fixed-dim: '#82d6bb'
  on-primary-fixed: '#002018'
  on-primary-fixed-variant: '#005140'
  secondary-fixed: '#d3e3ff'
  secondary-fixed-dim: '#b7c7e2'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485e'
  tertiary-fixed: '#d3e4fe'
  tertiary-fixed-dim: '#b7c8e1'
  on-tertiary-fixed: '#0b1c2f'
  on-tertiary-fixed-variant: '#38485d'
  background: '#f7faf7'
  on-background: '#181d1b'
  surface-variant: '#e0e3e0'
  seafoam-mist: '#E8F2F0'
typography:
  display:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  h1:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  h2:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  h3:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: '0'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: '0'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  container-max: 1280px
---

## Brand & Style

This design system is built on the pillars of transparency, precision, and architectural balance. It is designed for high-stakes financial and inventory environments where clarity is a form of luxury. The brand personality is "The Quiet Expert"—sophisticated, unobtrusive, and deeply reliable.

The design style follows a *Modern Minimalist* movement with a focus on *Tonal Layering*. It avoids the sterility of pure flat design by using "soft-depth"—a technique utilizing extremely diffused, low-opacity shadows and generous whitespace to create a sense of physical layering without visual noise. Every element is given significant room to breathe, ensuring that critical data remains the focal point of the user experience.

## Colors

The palette is anchored by *#1F7A63*, a deep, sophisticated green that evokes stability and growth. This is paired with a secondary "Onyx" for high-contrast typography and a tertiary "Seafoam Mist" for subtle accents and surface differentiation.

The color system is optimized for a sophisticated *Light Mode*. The background is kept as pure white (#FFFFFF) to maximize the perception of space. Neutral tones are pulled from a cool-slate spectrum to maintain a professional, tech-forward aesthetic. Success, warning, and error states should use desaturated versions of their respective colors to ensure they do not disrupt the calm, minimalist environment.

## Typography

The typography system uses *Manrope* for its modern, geometric construction and exceptional legibility in financial tables. It strikes a balance between professional rigor and contemporary friendliness.

*Inter* is utilized for secondary labels, captions, and micro-copy. Its utilitarian nature provides a clear functional distinction from the primary content. Weights are kept strictly between 400 (Regular) and 700 (Bold) to maintain a clean visual hierarchy. Use a tight letter-spacing for large headlines to create a premium "editorial" feel, while increasing spacing for small labels to ensure accessibility.

## Layout & Spacing

This design system employs a *Fixed Grid* philosophy for desktop interfaces to maintain a disciplined aesthetic, transitioning to a fluid model for mobile. A 12-column grid is used with generous 24px gutters.

Spacing follows an 8px linear scale, but the system prioritizes "L" and "XL" spacing increments to enforce the minimalist narrative. Avoid crowding components; if an element feels tight, increase the padding to the next scale increment. Alignment should be strictly left-aligned for data-heavy views to facilitate rapid scanning.

## Elevation & Depth

Depth is conveyed through *Ambient Shadows* rather than borders. Shadows are long, highly diffused, and use a hint of the primary green in the shadow tint to create a cohesive atmosphere.

- *Level 0 (Base):* Pure white background.
- *Level 1 (Subtle):* Used for cards and containers. Shadow: 0px 4px 20px rgba(31, 122, 99, 0.05).
- *Level 2 (Floating):* Used for dropdowns and navigation. Shadow: 0px 10px 40px rgba(0, 0, 0, 0.08).
- *Level 3 (Modal):* High-impact overlays. Shadow: 0px 24px 64px rgba(0, 0, 0, 0.12).

Avoid using solid black for shadows; always use a desaturated version of the secondary color or a tinted primary for a more sophisticated "light" feel.

## Shapes

The shape language is defined by *Large Roundedness*. This softens the professional "fintech" edge, making the application feel more approachable and modern.

- *Standard components (Buttons, Inputs):* 0.5rem (8px).
- *Medium containers (Cards, Modals):* 1rem (16px).
- *Large containers (Sections, Main Wrappers):* 1.5rem (24px).

Consistency in corner radii is paramount. Do not mix sharp and rounded corners within the same view.

## Components

### Buttons
Primary buttons use a solid *#1F7A63* fill with white text. Secondary buttons use a subtle *#E8F2F0* fill with primary green text. All buttons feature 16px horizontal and 12px vertical padding to maintain a substantial, high-quality feel.

### Input Fields
Inputs are borderless by default, using a light gray surface (#F1F5F9) and a 1px bottom border that transitions to the primary green on focus. This reduces visual clutter in dense inventory forms.

### Cards
Cards are the primary organizational unit. They must feature a white background and Level 1 elevation. Internal padding should never be less than 24px (md).

### Chips & Tags
Used for inventory status. These should be "pill-shaped" (3) with low-saturation background colors and high-saturation text to ensure readability without being loud.

### Data Tables
Tables are clean with no vertical borders. Use 16px padding between rows to allow for high legibility. The header row should use *label-sm* in uppercase with a subtle background tint.

### Inventory Highlights
Specific to this system, use large "Metric Cards" with oversized typography for inventory counts and financial totals, ensuring key performance indicators are the first thing a user sees.