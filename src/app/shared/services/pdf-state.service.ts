import { Injectable, signal, computed } from '@angular/core';
import { PdfAnnotation } from './pdf-mutate.service';

/**
 * Define as ferramentas disponíveis no editor.
 * Extraído para um tipo dedicado para facilitar a manutenção e escalabilidade.
 */
export type EditorTool = 'pan' | 'text' | 'image' | 'signature' | 'whiteout';

@Injectable({
  providedIn: 'root'
})
export class PdfStateService {
  
  // ==========================================================================
  // ESTADO PRIVADO (Fonte Única de Verdade)
  // ==========================================================================
  
  /** Buffer bruto do PDF carregado na memória do navegador. */
  private readonly fileBuffer = signal<ArrayBuffer | null>(null);

  // ==========================================================================
  // SINAIS PÚBLICOS E COMPUTADOS (Leitura e Reatividade UI)
  // ==========================================================================

  /** Retorna true se existe um documento carregado. Evita re-avaliações complexas na UI. */
  readonly isFileLoaded = computed(() => this.fileBuffer() !== null);
  
  /** Ferramenta atualmente selecionada pelo usuário (Mouse/Touch). */
  readonly activeTool = signal<EditorTool>('pan');
  
  /** Navegação e Zoom */
  readonly currentPage = signal<number>(1);
  readonly totalPages = signal<number>(0);
  readonly zoomLevel = signal<number>(1.0); // 1.0 representa 100% de escala nativa

  /** * Dicionário de anotações indexado pelo número da página.
   * Estrutura O(1) de acesso, fundamental para performance em PDFs longos.
   */
  readonly documentAnnotations = signal<Record<number, PdfAnnotation[]>>({});

  /** * Extrai de forma reativa apenas as anotações da página visível atual.
   * O Angular memoiza este valor, garantindo zero recálculos se a página não mudar.
   */
  readonly pageAnnotations = computed(() => {
    const page = this.currentPage();
    return this.documentAnnotations()[page] || [];
  });

  /** * Incrementador atuando como um gatilho reativo (Trigger).
   * Força a re-renderização do Canvas visual apenas quando a estrutura do PDF muda.
   */
  readonly documentVersion = signal<number>(1);

  // ==========================================================================
  // MÉTODOS DE MUTAÇÃO DE ESTADO
  // ==========================================================================

  /**
   * Atualiza as anotações exclusivamente da página atual.
   * Utiliza o padrão de atualização imutável para não quebrar a reatividade.
   * * @param updater Função de callback que recebe o array atual e retorna o novo modificado.
   */
  updatePageAnnotations(updater: (arr: PdfAnnotation[]) => PdfAnnotation[]): void {
    const page = this.currentPage();
    
    this.documentAnnotations.update(doc => {
      const currentAnnotations = doc[page] || [];
      return {
        ...doc,
        [page]: updater(currentAnnotations)
      };
    });
  }

  /**
   * Inicializa um novo documento, limpando integralmente o estado anterior
   * para evitar sobreposição de dados e garantir a liberação de memória (GC).
   * * @param buffer O ArrayBuffer bruto do arquivo PDF selecionado.
   */
  loadDocument(buffer: ArrayBuffer): void {
    this.fileBuffer.set(buffer);
    this.currentPage.set(1);
    this.zoomLevel.set(1.0);
    this.activeTool.set('pan');
    this.documentAnnotations.set({});
    this.documentVersion.set(1);
  }

  /**
   * Sobrescreve o documento atual com um novo buffer processado (ex: após rotacionar).
   * Limpa as anotações visuais flutuantes, pois agora fazem parte do buffer nativo.
   * * @param buffer O novo ArrayBuffer estrutural.
   * @param newTotalPages (Opcional) A nova contagem total de páginas.
   */
  updateDocument(buffer: ArrayBuffer, newTotalPages?: number): void {
    this.fileBuffer.set(buffer);
    
    if (newTotalPages !== undefined) {
      this.totalPages.set(newTotalPages);
      
      // Validação de segurança: Se a página atual foi excluída, recua o foco
      if (this.currentPage() > newTotalPages) {
        this.currentPage.set(newTotalPages > 0 ? newTotalPages : 1);
      }
    }
    
    // Esvazia as anotações da memória RAM para prevenir dados fantasmas
    this.documentAnnotations.set({});
    
    // Dispara a re-renderização do Canvas invocando uma nova versão do documento
    this.documentVersion.update(v => v + 1); 
  }

  /**
   * Encerra o fluxo atual e libera referências pesadas (ArrayBuffer) 
   * para que o Garbage Collector do navegador possa atuar instantaneamente.
   */
  closeDocument(): void {
    this.fileBuffer.set(null);
    this.totalPages.set(0);
    this.documentAnnotations.set({});
    this.documentVersion.set(1);
  }

  /**
   * Fornece acesso direto ao buffer nativo para motores de leitura/escrita.
   * * @returns ArrayBuffer ou null se nenhum documento estiver ativo.
   */
  getCurrentBuffer(): ArrayBuffer | null {
    return this.fileBuffer();
  }
}