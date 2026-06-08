import { 
  Component, 
  ViewChild, 
  ElementRef, 
  AfterViewInit, 
  OnInit,
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy,
  HostListener,
  signal,
  NgZone,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="modal-backdrop" 
      [class.is-picking-color]="isPickingColor()"
      (click)="cancel.emit()" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="modal-title">
      
      <div class="modal-content" (click)="$event.stopPropagation()">
        <header class="modal-header">
          <h3 id="modal-title">A sua Assinatura</h3>
          <button class="btn-close" (click)="cancel.emit()" title="Fechar">✕</button>
        </header>
        
        <div class="ink-selector">
          <span class="ink-label">Tinta:</span>
          
          <button 
            class="ink-btn ink-black" 
            [class.active]="inkColor() === '#0f172a'"
            (click)="changeInkColor('#0f172a')"
            title="Preto Clássico"></button>
            
          <button 
            class="ink-btn ink-blue" 
            [class.active]="inkColor() === '#2563eb'"
            (click)="changeInkColor('#2563eb')"
            title="Azul Esferográfica"></button>

          <div class="toolbar-divider"></div>

          <div class="color-picker-wrapper" (click)="openColorPicker()" title="Copiar cor do documento">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
            <input 
              #colorInput
              type="color" 
              class="hidden-color-input"
              [ngModel]="inkColor()" 
              (ngModelChange)="changeInkColor($event)"
              tabindex="-1">
          </div>
        </div>
        
        <div class="pad-wrapper">
          <div class="signature-baseline" aria-hidden="true"></div>
          
          @if (!hasSignature()) {
            <div class="watermark-hint" aria-hidden="true">Assine aqui</div>
          }
          
          <canvas #sigCanvas class="signature-canvas"></canvas>
        </div>

        <div class="actions">
          <button 
            class="btn-clear" 
            (click)="clearPad()" 
            [disabled]="!hasSignature()"
            title="Limpar e recomeçar">
            Refazer
          </button>
          
          <button 
            class="btn-save" 
            (click)="saveSignature()" 
            [disabled]="!hasSignature()">
            Inserir Documento
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* =====================================================================
       OTIMIZAÇÃO ARCH: Reset Host
       Garante que o wrapper Angular permite cliques antes do Backdrop
       ===================================================================== */
    :host { display: block; position: relative; z-index: 9999; }

    /* OTIMIZAÇÃO MOBILE: Uso de dvh evita bugs com a barra de endereços no iOS/Android */
    .modal-backdrop {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh;
      background: rgba(15, 23, 42, 0.6);
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      box-sizing: border-box; transition: opacity 0.2s ease-out;
      animation: fadeIn 0.2s ease-out;
      z-index: 9999; /* Sobrepõe tudo no body */
    }
    
    .modal-backdrop.is-picking-color { opacity: 0 !important; pointer-events: none; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal-content {
      background: #ffffff; padding: 24px; border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3); 
      width: 100%; max-width: 500px;
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h3 { margin: 0; color: #0f172a; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; }
    
    .btn-close {
      background: #f1f5f9; border: none; font-size: 1.1rem; color: #64748b;
      cursor: pointer; width: 32px; height: 32px; border-radius: 50%; 
      display: flex; align-items: center; justify-content: center; transition: all 0.2s;
    }
    .btn-close:hover { background: #e2e8f0; color: #0f172a; transform: scale(1.05); }

    /* Seletor de Tinta Profissional */
    .ink-selector { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .ink-label { font-size: 0.9rem; font-weight: 600; color: #475569; margin-right: 4px; }
    .ink-btn {
      width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent;
      cursor: pointer; padding: 0; transition: transform 0.2s, box-shadow 0.2s;
    }
    .ink-btn.active { transform: scale(1.15); box-shadow: 0 0 0 2px #fff, 0 0 0 4px #cbd5e1; }
    .ink-black { background: #0f172a; }
    .ink-blue { background: #2563eb; }

    .toolbar-divider { width: 1px; height: 24px; background: #e2e8f0; margin: 0 4px; }

    .color-picker-wrapper {
      width: 36px; height: 36px; border-radius: 50%; overflow: hidden;
      background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s; position: relative;
    }
    .color-picker-wrapper:hover { background: #e2e8f0; color: #0f172a; transform: scale(1.05); }
    .hidden-color-input { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }

    /* Lona Cinematográfica */
    .pad-wrapper {
      position: relative; border: 2px solid #e2e8f0; border-radius: 12px;
      background: #f8fafc; margin-bottom: 24px; overflow: hidden;
      width: 100%; height: auto; aspect-ratio: 16 / 7; /* Proporção ideal de assinatura */
      transition: border-color 0.2s; touch-action: none;
      display: flex; align-items: center; justify-content: center;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
    }
    .pad-wrapper:hover { border-color: #cbd5e1; }
    
    .watermark-hint {
      position: absolute; font-size: 1.5rem; font-weight: 700; color: #cbd5e1;
      opacity: 0.6; pointer-events: none; user-select: none; letter-spacing: 0.02em;
    }

    .signature-baseline {
      position: absolute; bottom: 25%; left: 8%; right: 8%;
      height: 2px; border-bottom: 2px dashed #94a3b8; opacity: 0.3; pointer-events: none; 
    }

    .signature-canvas {
      display: block; cursor: crosshair; touch-action: none; 
      width: 100%; height: 100%; position: absolute; top: 0; left: 0; z-index: 10;
    }

    /* Ações */
    .actions { display: flex; justify-content: space-between; align-items: center; }
    
    button {
      padding: 14px 24px; border-radius: 10px; cursor: pointer; border: none; 
      font-weight: 600; font-size: 1rem; transition: all 0.2s; outline: none;
    }
    button:focus-visible { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .btn-clear { background: #f1f5f9; color: #475569; }
    .btn-clear:hover:not(:disabled) { background: #e2e8f0; color: #0f172a; }
    
    .btn-save { background: #2563eb; color: white; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2); }
    .btn-save:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-2px); box-shadow: 0 6px 12px rgba(37, 99, 235, 0.3); }
    .btn-save:active:not(:disabled) { transform: translateY(0); }

    /* Mobile UX */
    @media (max-width: 480px) {
      .modal-content { padding: 20px 16px; border-radius: 16px; }
      .pad-wrapper { aspect-ratio: 16 / 9; }
      button { padding: 14px 20px; font-size: 0.95rem; }
    }
  `]
})
export class SignaturePadComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sigCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('colorInput') colorInputRef!: ElementRef<HTMLInputElement>;
  
  @Output() signatureSaved = new EventEmitter<string>(); 
  @Output() cancel = new EventEmitter<void>();

  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastPos = { x: 0, y: 0 };
  
  hasSignature = signal(false);
  inkColor = signal<string>('#0f172a'); 
  isPickingColor = signal(false);

  constructor(private elRef: ElementRef, private ngZone: NgZone) {}

  // ==========================================================================
  // OTIMIZAÇÃO ARCH: TELETRANSPORTE NATIVO
  // Arrancamos a modal do contexto do PDF e ejetamo-la para a root (body).
  // Isto previne bugs de Scaling (Zoom), Stacking Contexts e Overflow Hidden.
  // ==========================================================================
  ngOnInit(): void {
    document.body.appendChild(this.elRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.unbindNativeEvents();
    // Limpeza rigorosa: remove o elemento do DOM quando o Angular destruir o componente
    this.elRef.nativeElement.remove();
  }

  @HostListener('document:keydown.escape')
  onKeydownHandler() {
    this.cancel.emit();
  }

  @HostListener('window:resize')
  onResize() {
    if (!this.canvasRef) return;
    const currentData = this.canvasRef.nativeElement.toDataURL();
    const hadSignature = this.hasSignature();
    
    this.initCanvas();
    
    if (hadSignature) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
      };
      img.src = currentData;
      this.hasSignature.set(true);
    }
  }

  ngAfterViewInit(): void {
    this.initCanvas();
    this.bindNativeEvents();
  }

  /**
   * Ligação nativa para processamento de física a 120Hz fora da Zone do Angular
   */
  private bindNativeEvents(): void {
    this.ngZone.runOutsideAngular(() => {
      const canvas = this.canvasRef.nativeElement;
      canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
      canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
      window.addEventListener('pointerup', this.onPointerUp);
      window.addEventListener('pointercancel', this.onPointerUp);
    });
  }

  private unbindNativeEvents(): void {
    if (this.canvasRef?.nativeElement) {
      const canvas = this.canvasRef.nativeElement;
      canvas.removeEventListener('pointerdown', this.onPointerDown);
      canvas.removeEventListener('pointermove', this.onPointerMove);
    }
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    const wrapper = canvas.parentElement;
    if (!wrapper) return;

    // willReadFrequently acelera o color picker compositing na GPU
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    this.ctx = ctx;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    
    const logicalWidth = wrapper.clientWidth;
    const logicalHeight = wrapper.clientHeight; 

    canvas.width = logicalWidth * ratio;
    canvas.height = logicalHeight * ratio;

    this.ctx.scale(ratio, ratio);
    this.applyInkStyle();
    
    this.hasSignature.set(false);
  }

  private applyInkStyle(): void {
    this.ctx.lineWidth = 4.5; // Espessura elegante de caneta tinteiro
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = this.inkColor();
    this.ctx.fillStyle = this.inkColor();
  }

  changeInkColor(color: string): void {
    this.inkColor.set(color);
    this.applyInkStyle();

    // Mimetização retroativa de cor da tinta
    if (this.hasSignature()) {
      const canvas = this.canvasRef.nativeElement;
      const prevComposite = this.ctx.globalCompositeOperation;
      
      this.ctx.globalCompositeOperation = 'source-in';
      this.ctx.fillRect(0, 0, canvas.width, canvas.height);
      this.ctx.globalCompositeOperation = prevComposite;
    }
  }

  async openColorPicker(): Promise<void> {
    if ('EyeDropper' in window) {
      this.isPickingColor.set(true);
      setTimeout(async () => {
        try {
          const eyeDropper = new (window as any).EyeDropper();
          const result = await eyeDropper.open();
          this.changeInkColor(result.sRGBHex);
        } catch (e) {
          // Cancelado via ESC
        } finally {
          this.isPickingColor.set(false);
        }
      }, 50);
    } else {
      this.colorInputRef.nativeElement.click();
    }
  }

  private getCoords(event: PointerEvent): { x: number, y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
  
  // ==========================================================================
  // MOTOR DE DESENHO BLINDADO
  // ==========================================================================
  
  private onPointerDown = (event: PointerEvent): void => {
    if (event.cancelable) event.preventDefault();
    
    const canvas = this.canvasRef.nativeElement;
    
    // Fail-Safe: Em ecrãs touch ruins, setPointerCapture pode falhar silenciosamente
    try { canvas.setPointerCapture(event.pointerId); } catch (e) {}

    this.isDrawing = true;
    
    if (!this.hasSignature()) {
      this.ngZone.run(() => this.hasSignature.set(true));
    }
    
    const coords = this.getCoords(event);
    this.lastPos = coords;

    this.ctx.beginPath();
    this.ctx.arc(coords.x, coords.y, this.ctx.lineWidth / 2, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.beginPath();
    this.ctx.moveTo(coords.x, coords.y);
  }

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.isDrawing) return;
    if (event.cancelable) event.preventDefault();

    const coords = this.getCoords(event);

    this.ctx.lineTo(coords.x, coords.y);
    this.ctx.stroke();

    this.lastPos = coords;
  }

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    
    try { this.canvasRef.nativeElement.releasePointerCapture(event.pointerId); } catch (e) {}
  }
  
  // ==========================================================================
  // COMANDOS FINAIS
  // ==========================================================================
  
  clearPad(): void {
    const canvas = this.canvasRef.nativeElement;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;

    this.ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    this.hasSignature.set(false);
  }

  saveSignature(): void {
    if (!this.hasSignature()) return;
    
    // Transfere o raster final para base64 ultra compressa (png transparente)
    const dataUrl = this.canvasRef.nativeElement.toDataURL('image/png');
    this.signatureSaved.emit(dataUrl);
  }
}