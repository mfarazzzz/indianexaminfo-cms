/**
 * coreBlocks.ts — Registers all 14 built-in block types.
 * Call registerCoreBlocks() once in main.tsx before any component renders.
 * Feature-flagged: html block registers only when VITE_ENABLE_HTML_BLOCK === 'true'.
 */
import {
  Heading, AlignLeft, FileText, Image, Images, MousePointer,
  Download, Table2, Quote, AlertCircle, Minus, Video, HelpCircle,
  CalendarDays, Code,
} from 'lucide-react'
import { register } from './blockRegistry'

import { HeadingSchema, headingDefault }                     from './schemas/headingSchema'
import { ParagraphSchema, paragraphDefault }                 from './schemas/paragraphSchema'
import { RichTextSchema, richTextDefault }                   from './schemas/richTextSchema'
import { ImageSchema, imageDefault }                         from './schemas/imageSchema'
import { GallerySchema, galleryDefault }                     from './schemas/gallerySchema'
import { ButtonSchema, buttonDefault }                       from './schemas/buttonSchema'
import { DownloadCardSchema, downloadCardDefault }           from './schemas/downloadCardSchema'
import { TableSchema, tableDefault }                         from './schemas/tableSchema'
import { QuoteSchema, quoteDefault }                         from './schemas/quoteSchema'
import { AlertSchema, alertDefault }                         from './schemas/alertSchema'
import { DividerSchema, dividerDefault }                     from './schemas/dividerSchema'
import { VideoSchema, videoDefault }                         from './schemas/videoSchema'
import { FAQSchema, faqDefault }                             from './schemas/faqSchema'
import { TimelineReferenceSchema, timelineReferenceDefault } from './schemas/timelineReferenceSchema'
import { HTMLSchema, htmlDefault }                           from './schemas/htmlSchema'

import { HeadingEditor }           from '@/components/blocks/editors/HeadingEditor'
import { ParagraphEditor }         from '@/components/blocks/editors/ParagraphEditor'
import { RichTextEditor }          from '@/components/blocks/editors/RichTextEditor'
import { ImageEditor }             from '@/components/blocks/editors/ImageEditor'
import { GalleryEditor }           from '@/components/blocks/editors/GalleryEditor'
import { ButtonEditor }            from '@/components/blocks/editors/ButtonEditor'
import { DownloadCardEditor }      from '@/components/blocks/editors/DownloadCardEditor'
import { TableEditor }             from '@/components/blocks/editors/TableEditor'
import { QuoteEditor }             from '@/components/blocks/editors/QuoteEditor'
import { AlertEditor }             from '@/components/blocks/editors/AlertEditor'
import { DividerEditor }           from '@/components/blocks/editors/DividerEditor'
import { VideoEditor }             from '@/components/blocks/editors/VideoEditor'
import { FAQEditor }               from '@/components/blocks/editors/FAQEditor'
import { TimelineReferenceEditor } from '@/components/blocks/editors/TimelineReferenceEditor'
import { HTMLEditor }              from '@/components/blocks/editors/HTMLEditor'

import { HeadingRenderer }           from '@/components/blocks/renderers/HeadingRenderer'
import { ParagraphRenderer }         from '@/components/blocks/renderers/ParagraphRenderer'
import { RichTextRenderer }          from '@/components/blocks/renderers/RichTextRenderer'
import { ImageRenderer }             from '@/components/blocks/renderers/ImageRenderer'
import { GalleryRenderer }           from '@/components/blocks/renderers/GalleryRenderer'
import { ButtonRenderer }            from '@/components/blocks/renderers/ButtonRenderer'
import { DownloadCardRenderer }      from '@/components/blocks/renderers/DownloadCardRenderer'
import { TableRenderer }             from '@/components/blocks/renderers/TableRenderer'
import { QuoteRenderer }             from '@/components/blocks/renderers/QuoteRenderer'
import { AlertRenderer }             from '@/components/blocks/renderers/AlertRenderer'
import { DividerRenderer }           from '@/components/blocks/renderers/DividerRenderer'
import { VideoRenderer }             from '@/components/blocks/renderers/VideoRenderer'
import { FAQRenderer }               from '@/components/blocks/renderers/FAQRenderer'
import { TimelineReferenceRenderer } from '@/components/blocks/renderers/TimelineReferenceRenderer'
import { HTMLRenderer }              from '@/components/blocks/renderers/HTMLRenderer'

export function registerCoreBlocks(): void {
  register({ type: 'heading',            label: 'Heading',            icon: Heading,      schema: HeadingSchema,            defaultContent: headingDefault,            editor: HeadingEditor,           renderer: HeadingRenderer            })
  register({ type: 'paragraph',          label: 'Paragraph',          icon: AlignLeft,    schema: ParagraphSchema,          defaultContent: paragraphDefault,          editor: ParagraphEditor,         renderer: ParagraphRenderer          })
  register({ type: 'rich_text',          label: 'Rich Text',          icon: FileText,     schema: RichTextSchema,           defaultContent: richTextDefault,           editor: RichTextEditor,          renderer: RichTextRenderer           })
  register({ type: 'image',              label: 'Image',              icon: Image,        schema: ImageSchema,              defaultContent: imageDefault,              editor: ImageEditor,             renderer: ImageRenderer              })
  register({ type: 'gallery',            label: 'Gallery',            icon: Images,       schema: GallerySchema,            defaultContent: galleryDefault,            editor: GalleryEditor,           renderer: GalleryRenderer            })
  register({ type: 'button',             label: 'Button',             icon: MousePointer, schema: ButtonSchema,             defaultContent: buttonDefault,             editor: ButtonEditor,            renderer: ButtonRenderer             })
  register({ type: 'download_card',      label: 'Download Card',      icon: Download,     schema: DownloadCardSchema,       defaultContent: downloadCardDefault,       editor: DownloadCardEditor,      renderer: DownloadCardRenderer       })
  register({ type: 'table',              label: 'Table',              icon: Table2,       schema: TableSchema,              defaultContent: tableDefault,              editor: TableEditor,             renderer: TableRenderer              })
  register({ type: 'quote',              label: 'Quote',              icon: Quote,        schema: QuoteSchema,              defaultContent: quoteDefault,              editor: QuoteEditor,             renderer: QuoteRenderer              })
  register({ type: 'alert_box',          label: 'Alert Box',          icon: AlertCircle,  schema: AlertSchema,              defaultContent: alertDefault,              editor: AlertEditor,             renderer: AlertRenderer              })
  register({ type: 'divider',            label: 'Divider',            icon: Minus,        schema: DividerSchema,            defaultContent: dividerDefault,            editor: DividerEditor,           renderer: DividerRenderer            })
  register({ type: 'video',              label: 'Video',              icon: Video,        schema: VideoSchema,              defaultContent: videoDefault,              editor: VideoEditor,             renderer: VideoRenderer              })
  register({ type: 'faq',               label: 'FAQ',                icon: HelpCircle,  schema: FAQSchema,                defaultContent: faqDefault,                editor: FAQEditor,               renderer: FAQRenderer                })
  register({ type: 'timeline_reference', label: 'Timeline Reference', icon: CalendarDays, schema: TimelineReferenceSchema,  defaultContent: timelineReferenceDefault,  editor: TimelineReferenceEditor, renderer: TimelineReferenceRenderer  })

  if (import.meta.env.VITE_ENABLE_HTML_BLOCK === 'true') {
    register({ type: 'html', label: 'Custom HTML', icon: Code, schema: HTMLSchema, defaultContent: htmlDefault, editor: HTMLEditor, renderer: HTMLRenderer })
  }
}
