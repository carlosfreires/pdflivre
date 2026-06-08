import { 
  Component, 
  ChangeDetectionStrategy, 
  inject, 
  ElementRef,
  computed,
  signal,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PdfStateService } from '../../shared/services/pdf-state.service';
import { SignaturePadComponent } from './signature-pad.component';
import { PdfAnnotation } from '../../shared/services/pdf-mutate.service';

// OTIMIZAÇÃO ARCH: A interface agora é puramente focada em Geometria e Estilo visual.
// O estado transiente de 'Seleção/Edição' é gerido por Signals locais (Zero TS Errors).
export type UIAnnotation = PdfAnnotation & { 
  width?: number; 
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
};

@Component({
  selector: 'app-editor-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule, SignaturePadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showSignaturePad()) {
      <app-signature-pad 
        (signatureSaved)="onSignatureSaved($event)"
        (cancel)="closeSignaturePad()">
      </app-signature-pad>
    }

    <div 
      class="overlay-area" 
      (pointerdown)="onOverlayClick($event)"
      [class.crosshair-cursor]="pdfState.activeTool() === 'text' || pdfState.activeTool() === 'whiteout'"
      [class.pass-through]="pdfState.activeTool() === 'text' || pdfState.activeTool() === 'whiteout'">
      
      @for (item of uiAnnotations(); track item.id) {
        
        <div 
          class="annotation-box"
          [class.type-text]="item.type === 'text'"
          [class.type-whiteout]="item.type === 'whiteout'"
          [class.type-image]="item.type === 'image'"
          [class.is-active]="selectedId() === item.id"
          [style.left.%]="item.x * 100" 
          [style.top.%]="item.y * 100"
          [style.width.%]="item.width ? item.width * 100 : null"
          [style.height.%]="item.height ? item.height * 100 : null"
          [style.background-color]="item.backgroundColor"
          (pointerdown)="startDrag($event, item)">
          
          @if (selectedId() === item.id) {
            <div class="mini-toolbar" (pointerdown)="$event.stopPropagation()">
              
              <div class="drag-area" (pointerdown)="startDrag($event, item, true)" title="Arraste para mover">
                <svg width="12" height="16" viewBox="0 0 10 16" fill="currentColor">
                  <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                  <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                  <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
                </svg>
              </div>
              
              <div class="toolbar-divider"></div>

              @if (item.type === 'text') {
                <div class="toolbar-group">
                  <select [ngModel]="item.fontFamily" (ngModelChange)="updateTextFormat(item, { fontFamily: $event })" title="Fonte">
                    <option value="Helvetica, sans-serif">Helvetica</option>
                    <option value="'Times New Roman', serif">Times</option>
                    <option value="'Courier New', monospace">Courier</option>
                  </select>
                  
                  <input 
                    type="number" 
                    [ngModel]="item.fontSize" 
                    (ngModelChange)="updateTextFormat(item, { fontSize: +$event })" 
                    min="8" max="120" title="Tamanho">
                </div>
                
                <div class="toolbar-divider"></div>
                
                <div class="toolbar-group">
                  <div class="color-picker-wrapper" title="Cor do Texto">
                    <input type="color" [ngModel]="item.color" (ngModelChange)="updateTextFormat(item, { color: $event })">
                  </div>
                  <div class="color-picker-wrapper bg-picker" title="Cor de Fundo">
                    <input type="color" [ngModel]="item.backgroundColor === 'transparent' ? '#ffffff' : item.backgroundColor" (ngModelChange)="updateTextFormat(item, { backgroundColor: $event })">
                  </div>
                  <button class="btn-icon" (click)="updateTextFormat(item, { backgroundColor: 'transparent' })" title="Fundo Transparente">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                  </button>
                </div>
                
                <div class="toolbar-divider"></div>
                
                @if (editingTextId() !== item.id) {
                  <button class="btn-icon primary" (click)="enterEditMode(item.id)" title="Editar Texto">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                }
              }
              
              @if (item.type === 'whiteout') {
                <div class="toolbar-group">
                  <span class="toolbar-label">Cor:</span>
                  <div class="color-picker-wrapper bg-picker" title="Cor da Tarja">
                    <input type="color" [ngModel]="item.backgroundColor" (ngModelChange)="updateTextFormat(item, { backgroundColor: $event })">
                  </div>
                </div>
              }

              @if (editingTextId() !== item.id) {
                <div class="toolbar-divider"></div>
                <button class="btn-icon danger" (click)="deleteSelected()" title="Remover">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              }
            </div>
          }

          @if (item.type === 'text') {
            <div class="textarea-container">
              <div 
                class="textarea-size-mimic" 
                aria-hidden="true"
                [style.font-family]="item.fontFamily"
                [style.font-size.px]="item.fontSize"
                [style.color]="item.color">
                {{ item.text + ' ' }}
              </div>
              
              @if (editingTextId() === item.id) {
                <textarea 
                  [ngModel]="item.text"
                  (ngModelChange)="updateItemText(item, $event)"
                  autofocus
                  class="text-input"
                  placeholder="Escreva aqui..."
                  [style.font-family]="item.fontFamily"
                  [style.font-size.px]="item.fontSize"
                  [style.color]="item.color"
                  (pointerdown)="$event.stopPropagation()">
                </textarea>
              } @else {
                <div 
                  class="text-display" 
                  [style.font-family]="item.fontFamily"
                  [style.font-size.px]="item.fontSize"
                  [style.color]="item.color"
                  (dblclick)="enterEditMode(item.id, $event)">
                  {{ item.text || 'Toque em Editar...' }}
                </div>
              }
            </div>
          }

          @if (item.type === 'image') {
            <img [src]="item.dataUrl" alt="Imagem Inserida" draggable="false" class="image-content">
          }

          @if (selectedId() === item.id) {
            <div class="resize-handle corner-br" (pointerdown)="startResize($event, item)"></div>
            <div class="resize-handle corner-bl" (pointerdown)="startResize($event, item, true)"></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; pointer-events: none; }
    
    .overlay-area { width: 100%; height: 100%; position: relative; overflow: hidden; touch-action: none; }
    .overlay-area.crosshair-cursor { pointer-events: auto; cursor: crosshair; }
    .overlay-area.pass-through .annotation-box { pointer-events: none !important; }

    /* ========================================================= */
    /* FÍSICA MESTRE DA CAIXA                                    */
    /* ========================================================= */
    .annotation-box {
      position: absolute; pointer-events: auto; touch-action: none;
      outline: 2px solid transparent; outline-offset: 0px; border-radius: 2px;
      transition: background-color 0.2s;
    }
    
    .annotation-box:hover { outline-color: rgba(13, 153, 255, 0.4); }
    
    /* Seleção Premium Azul (SaaS Standard) */
    .annotation-box.is-active { 
      z-index: 100 !important; outline-color: #0d99ff; 
      box-shadow: 0 4px 15px rgba(0,0,0,0.1); 
    }
    
    .annotation-box { cursor: grab; }
    .annotation-box.is-active { cursor: grabbing; }

    .type-whiteout { z-index: 20; border: 1px solid rgba(0,0,0,0.05); }
    .type-image { z-index: 30; }
    .type-text { z-index: 40; min-width: 80px; min-height: 30px; }

    /* ========================================================= */
    /* CONTEÚDOS ESPECÍFICOS                                     */
    /* ========================================================= */
    .textarea-container { display: grid; width: 100%; height: 100%; }
    .textarea-size-mimic, .text-input, .text-display {
      grid-area: 1 / 1 / 2 / 2;
      padding: 8px; white-space: pre-wrap; word-break: break-word; line-height: 1.4;
      margin: 0; box-sizing: border-box;
    }
    .textarea-size-mimic { visibility: hidden; pointer-events: none; }
    
    .text-input { 
      width: 100%; height: 100%; resize: none; border: none; background: transparent; 
      outline: none; overflow: hidden; cursor: text;
    }
    .text-display { user-select: none; width: 100%; height: 100%; }
    
    .image-content { width: 100%; height: 100%; object-fit: fill; pointer-events: none; display: block; border-radius: 2px; }

    /* ========================================================= */
    /* TOOLBAR FLUTUANTE (Glassmorphism UI)                      */
    /* ========================================================= */
    .mini-toolbar {
      position: absolute; bottom: calc(100% + 14px); left: 50%; transform: translateX(-50%);
      display: flex; gap: 6px; align-items: center;
      background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(12px);
      padding: 6px; border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08); 
      border: 1px solid rgba(0,0,0,0.06);
      z-index: 150; cursor: default; white-space: nowrap; animation: popUp 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes popUp { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
    
    .drag-area { padding: 4px 8px; cursor: grab; color: #94a3b8; display: flex; align-items: center; justify-content: center; transition: color 0.2s; }
    .drag-area:hover { color: #0d99ff; }
    .drag-area:active { cursor: grabbing; color: #0070e0; }

    .toolbar-group { display: flex; gap: 4px; align-items: center; }
    .toolbar-label { font-size: 0.75rem; font-weight: 600; color: #475569; margin: 0 4px; }
    .toolbar-divider { width: 1px; height: 18px; background: #e2e8f0; margin: 0 4px; }
    
    .mini-toolbar select, .mini-toolbar input[type="number"] {
      border: 1px solid transparent; border-radius: 4px; padding: 4px;
      font-size: 13px; font-weight: 500; outline: none; background: transparent; color: #334155; cursor: pointer; transition: background 0.2s;
    }
    .mini-toolbar select:hover, .mini-toolbar input[type="number"]:hover { background: #f1f5f9; }
    .mini-toolbar input[type="number"] { width: 44px; text-align: center; }
    
    .color-picker-wrapper {
      width: 26px; height: 26px; border-radius: 50%; overflow: hidden;
      border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center;
      cursor: pointer; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
    }
    .color-picker-wrapper.bg-picker { border-radius: 4px; }
    .mini-toolbar input[type="color"] { width: 200%; height: 200%; border: none; padding: 0; cursor: pointer; outline: none; }
    
    .btn-icon {
      background: transparent; border: 1px solid transparent; border-radius: 6px; cursor: pointer;
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; outline: none; color: #64748b;
    }
    .btn-icon:hover { background: #f1f5f9; color: #0f172a; }
    .btn-icon.primary { color: #0d99ff; background: rgba(13, 153, 255, 0.1); }
    .btn-icon.primary:hover { background: #0d99ff; color: white; }
    .btn-icon.danger:hover { background: #fef2f2; color: #dc2626; }

    /* ========================================================= */
    /* HANDLES DE REDIMENSIONAMENTO (Design Quadrado)            */
    /* ========================================================= */
    .resize-handle {
      position: absolute; width: 10px; height: 10px; 
      background: #ffffff; border: 2px solid #0d99ff; border-radius: 1px; /* Estilo Quadrado Figma */
      z-index: 100; box-shadow: 0 1px 3px rgba(0,0,0,0.2); pointer-events: auto;
    }
    /* Hitbox Expandida invisível para Touchscreen */
    .resize-handle::before { content: ''; position: absolute; top: -14px; left: -14px; right: -14px; bottom: -14px; }
    
    .corner-br { bottom: -5px; right: -5px; cursor: nwse-resize; }
    .corner-bl { bottom: -5px; left: -5px; cursor: nesw-resize; }

    @media (hover: none) and (pointer: coarse) {
      .resize-handle { width: 14px; height: 14px; border-width: 2.5px; }
      .corner-br { bottom: -7px; right: -7px; }
      .corner-bl { bottom: -7px; left: -7px; }
      .mini-toolbar { transform: translateX(-50%) scale(1.1); top: -80px; bottom: auto; } /* Maior e no topo em mobile */
    }
  `]
})
export class EditorOverlayComponent {
  public readonly pdfState = inject(PdfStateService);
  public readonly elRef = inject(ElementRef);

  uiAnnotations = computed(() => this.pdfState.pageAnnotations() as UIAnnotation[]);
  showSignaturePad = computed(() => this.pdfState.activeTool() === 'signature');

  // ==========================================================================
  // ESTADOS LOCAIS DE SELEÇÃO E EDIÇÃO (Zero Conflitos no State Manager)
  // ==========================================================================
  selectedId = signal<string | null>(null);
  editingTextId = signal<string | null>(null);

  // Física e Geometria
  draggingItemId: string | null = null;
  resizingItemId: string | null = null;
  resizingDirection: 'br' | 'bl' | null = null;
  
  private dragOffset = { x: 0, y: 0 };
  private resizeStartData = { x: 0, y: 0, width: 0, height: 0, ptrX: 0, ptrY: 0 };

  // ==========================================================================
  // GESTÃO DE FOCO GLOBAL (Click-Away)
  // ==========================================================================
  
  /** Se o utilizador clicar na UI Global do Documento (Fora do Editor), Remove Foco. */
  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    // Se o clique for DENTRO do overlay, as funções locais processam.
    if (this.elRef.nativeElement.contains(event.target)) return;
    
    this.finalizeEditing();
    this.selectedId.set(null);
  }

  /** Delete A11y (Teclado) */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Impede apagar o componente se estivermos a escrever ativamente no textarea
      if (this.selectedId() && !this.editingTextId()) {
        this.deleteSelected();
      }
    }
  }

  // ==========================================================================
  // MOTOR DE FÍSICA E MOVIMENTO
  // ==========================================================================

  startDrag(event: PointerEvent, item: UIAnnotation, forceFromToolbar: boolean = false): void {
    const target = event.target as HTMLElement;
    
    if (!forceFromToolbar) {
      if (['TEXTAREA', 'BUTTON', 'SELECT', 'INPUT'].includes(target.tagName) || target.classList.contains('resize-handle')) return;
      if (target.closest('.mini-toolbar')) return;
      if (event.button !== 0 && event.pointerType === 'mouse') return;
    }

    event.preventDefault();
    event.stopPropagation();
    
    // Se selecionou um novo item, salva o anterior.
    if (this.selectedId() !== item.id) {
      this.finalizeEditing();
      this.selectedId.set(item.id);
    }

    this.draggingItemId = item.id;
    
    const rect = this.elRef.nativeElement.getBoundingClientRect();
    const itemPxX = item.x * rect.width;
    const itemPxY = item.y * rect.height;
    
    this.dragOffset = {
      x: (event.clientX - rect.left) - itemPxX,
      y: (event.clientY - rect.top) - itemPxY
    };
  }

  startResize(event: PointerEvent, item: UIAnnotation, isLeftCorner: boolean = false): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.selectedId() !== item.id) {
      this.finalizeEditing();
      this.selectedId.set(item.id);
    }

    this.resizingItemId = item.id;
    this.resizingDirection = isLeftCorner ? 'bl' : 'br';
    
    const targetEl = (event.target as HTMLElement).closest('.annotation-box') as HTMLElement;
    const boxRect = targetEl.getBoundingClientRect();
    const containerRect = this.elRef.nativeElement.getBoundingClientRect();

    this.resizeStartData = {
      x: item.x,
      y: item.y,
      width: item.width || (boxRect.width / containerRect.width),
      height: item.height || (boxRect.height / containerRect.height),
      ptrX: event.clientX,
      ptrY: event.clientY
    };
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (!this.draggingItemId && !this.resizingItemId) return;
    const rect = this.elRef.nativeElement.getBoundingClientRect();

    if (this.draggingItemId) {
      let newX = (event.clientX - rect.left - this.dragOffset.x) / rect.width;
      let newY = (event.clientY - rect.top - this.dragOffset.y) / rect.height;

      newX = Math.max(0, Math.min(newX, 0.95));
      newY = Math.max(0, Math.min(newY, 0.95));

      this.pdfState.updatePageAnnotations(arr => 
        arr.map(item => item.id === this.draggingItemId ? ({ ...item, x: newX, y: newY } as PdfAnnotation) : item)
      );
    } 
    else if (this.resizingItemId) {
      const targetItem = this.uiAnnotations().find(i => i.id === this.resizingItemId);
      if (!targetItem) return;

      const isWhiteout = targetItem.type === 'whiteout';
      const minW = isWhiteout ? 0.005 : 0.05;
      const minH = isWhiteout ? 0.005 : 0.02;

      const deltaX = (event.clientX - this.resizeStartData.ptrX) / rect.width;
      const deltaY = (event.clientY - this.resizeStartData.ptrY) / rect.height;
      
      let newWidth = this.resizeStartData.width;
      let newHeight = this.resizeStartData.height;
      let newX = this.resizeStartData.x;

      if (this.resizingDirection === 'br') {
        newWidth = Math.max(minW, this.resizeStartData.width + deltaX);
        newHeight = Math.max(minH, this.resizeStartData.height + deltaY);
      } else if (this.resizingDirection === 'bl') {
        const proposedWidth = this.resizeStartData.width - deltaX;
        if (proposedWidth > minW) {
          newWidth = proposedWidth;
          newX = this.resizeStartData.x + deltaX;
        }
        newHeight = Math.max(minH, this.resizeStartData.height + deltaY);
      }

      this.pdfState.updatePageAnnotations(arr => 
        arr.map(item => item.id === this.resizingItemId ? ({ ...item, x: newX, width: newWidth, height: newHeight } as PdfAnnotation) : item)
      );
    }
  }

  @HostListener('document:pointerup')
  @HostListener('document:pointercancel')
  onPointerUp(): void {
    this.draggingItemId = null;
    this.resizingItemId = null;
    this.resizingDirection = null;
  }

  // ==========================================================================
  // CRIAÇÃO E CLIQUE NO FUNDO
  // ==========================================================================

  onOverlayClick(event: PointerEvent): void {
    // 1. Sempre que clicar no fundo vazio, limpa qualquer seleção ativa e esvazia texto em branco.
    this.finalizeEditing();
    this.selectedId.set(null);

    const tool = this.pdfState.activeTool();
    if (tool === 'pan') return;
    if (tool !== 'text' && tool !== 'whiteout') return;

    // 2. Cria nova anotação
    const coords = this.getRelativeCoords(event.clientX, event.clientY);
    const newId = crypto.randomUUID();
    let newNote: UIAnnotation;
    
    if (tool === 'text') {
      newNote = { 
        id: newId, type: 'text', x: coords.x, y: coords.y, 
        text: '', width: 0.25, backgroundColor: 'transparent',
        fontSize: 16, fontFamily: 'Helvetica, sans-serif', color: '#0f172a'
      };
    } else {
      newNote = { 
        id: newId, type: 'whiteout', x: coords.x, y: coords.y, 
        width: 0.15, height: 0.05, backgroundColor: '#ffffff'
      };
    }

    this.pdfState.updatePageAnnotations(arr => [...arr, newNote as PdfAnnotation]);
    
    // 3. Foca e Ativa a Nova Caixa Imediatamente
    this.selectedId.set(newId);
    if (tool === 'text') this.editingTextId.set(newId);

    // Regressa à ferramenta pan para evitar a criação acidental de dezenas de caixas
    this.pdfState.activeTool.set('pan'); 
  }

  // ==========================================================================
  // GESTÃO DE DADOS DA ANOTAÇÃO
  // ==========================================================================

  enterEditMode(id: string, event?: Event): void {
    event?.stopPropagation();
    this.selectedId.set(id);
    this.editingTextId.set(id);
  }

  /** Rotina mestre que limpa texto vazio e encerra o estado de edição da <textarea> */
  finalizeEditing(): void {
    const editId = this.editingTextId();
    if (editId) {
      const item = this.uiAnnotations().find(i => i.id === editId);
      
      // OTIMIZAÇÃO ARCH: Cast seguro para evitar TS2339 e limpar textos vazios
      if (item && item.type === 'text') {
        const textContent = (item as any).text;
        if (!textContent || !textContent.trim()) {
          this.pdfState.updatePageAnnotations(arr => arr.filter(n => n.id !== editId));
          this.selectedId.set(null);
        }
      }
      this.editingTextId.set(null);
    }
  }

  updateItemText(note: UIAnnotation, newText: string): void {
    this.pdfState.updatePageAnnotations(arr => 
      arr.map(n => n.id === note.id ? ({ ...n, text: newText } as PdfAnnotation) : n)
    );
  }

  updateTextFormat(note: UIAnnotation, formatObj: Partial<UIAnnotation>): void {
    this.pdfState.updatePageAnnotations(arr => 
      arr.map(n => n.id === note.id ? ({ ...n, ...formatObj } as PdfAnnotation) : n)
    );
  }

  deleteAnnotation(event: PointerEvent, itemToDelete: UIAnnotation): void {
    event.preventDefault();
    event.stopPropagation(); 
    this.pdfState.updatePageAnnotations(arr => arr.filter(n => n.id !== itemToDelete.id));
    this.selectedId.set(null);
    this.editingTextId.set(null);
  }

  deleteSelected(): void {
    const id = this.selectedId();
    if (id) {
      this.pdfState.updatePageAnnotations(arr => arr.filter(n => n.id !== id));
      this.selectedId.set(null);
      this.editingTextId.set(null);
    }
  }

  // ==========================================================================
  // ASSINATURA & HELPERS
  // ==========================================================================

  onSignatureSaved(base64Image: string): void {
    const newId = crypto.randomUUID();
    const newImg: UIAnnotation = {
      id: newId, type: 'image', x: 0.1, y: 0.1, width: 0.25, height: 0.12, dataUrl: base64Image
    };
    
    this.finalizeEditing();
    this.pdfState.updatePageAnnotations(arr => [...arr, newImg as PdfAnnotation]);
    this.selectedId.set(newId);
    this.closeSignaturePad();
  }

  closeSignaturePad(): void {
    this.pdfState.activeTool.set('pan');
  }

  private getRelativeCoords(clientX: number, clientY: number) {
    const rect = this.elRef.nativeElement.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, (clientX - rect.left) / rect.width), 0.95),
      y: Math.min(Math.max(0, (clientY - rect.top) / rect.height), 0.95)
    };
  }
}