interface SimilarityScore {
  windowId1: string;
  windowId2: string;
  score: number;
  keywords: string[];
}

interface WindowContent {
  id: string;
  title: string;
  content: string;
  keywords: string[];
  wordCount: number;
}

export class ContentSimilarityAnalyzer {
  private stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can',
    'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those', 'i', 'you',
    'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
    'his', 'her', 'its', 'our', 'their'
  ]);

  extractKeywords(text: string): string[] {
    if (!text) return [];

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word =>
        word.length > 2 &&
        !this.stopWords.has(word) &&
        !/^\d+$/.test(word)
      );

    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(entry => entry[0]);
  }

  processWindowContent(id: string, title: string, content: string): WindowContent {
    const combinedText = `${title} ${content}`;
    const keywords = this.extractKeywords(combinedText);
    const wordCount = combinedText.split(/\s+/).length;

    return {
      id,
      title,
      content,
      keywords,
      wordCount
    };
  }

  calculateJaccardSimilarity(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 && keywords2.length === 0) return 0;

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  calculateCosineSimilarity(keywords1: string[], keywords2: string[]): number {
    const allKeywords = Array.from(new Set([...keywords1, ...keywords2]));

    if (allKeywords.length === 0) return 0;

    const vector1 = allKeywords.map(keyword => keywords1.includes(keyword) ? 1 : 0);
    const vector2 = allKeywords.map(keyword => keywords2.includes(keyword) ? 1 : 0);

    const dotProduct = vector1.reduce((sum: number, a: number, i: number) => sum + (a * vector2[i]), 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum: number, a: number) => sum + (a * a), 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum: number, a: number) => sum + (a * a), 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  calculateSimilarity(window1: WindowContent, window2: WindowContent): SimilarityScore {
    const jaccardScore = this.calculateJaccardSimilarity(window1.keywords, window2.keywords);
    const cosineScore = this.calculateCosineSimilarity(window1.keywords, window2.keywords);

    // Combine scores with weights
    const combinedScore = (jaccardScore * 0.6) + (cosineScore * 0.4);

    // Boost score if titles are similar
    const titleSimilarity = this.calculateJaccardSimilarity(
      this.extractKeywords(window1.title),
      this.extractKeywords(window2.title)
    );

    const finalScore = Math.min(1, combinedScore + (titleSimilarity * 0.2));

    const commonKeywords = window1.keywords.filter(k => window2.keywords.includes(k));

    const calcDetails = {
      window1: { id: window1.id, title: window1.title, keywords: window1.keywords },
      window2: { id: window2.id, title: window2.title, keywords: window2.keywords },
      jaccardScore: Math.round(jaccardScore * 100) / 100,
      cosineScore: Math.round(cosineScore * 100) / 100,
      combinedScore: Math.round(combinedScore * 100) / 100,
      titleSimilarity: Math.round(titleSimilarity * 100) / 100,
      finalScore: Math.round(finalScore * 100) / 100,
      commonKeywords
    };

    console.log('🧮 Similarity calculation:', calcDetails);

    // Send to system output via event bus
    if (typeof window !== 'undefined' && (window as any).eventBus) {
      (window as any).eventBus.emit('system:output', {
        text: `🧮 Similarity calculation:\n${JSON.stringify(calcDetails, null, 2)}\n\n`
      });
    }

    return {
      windowId1: window1.id,
      windowId2: window2.id,
      score: finalScore,
      keywords: commonKeywords
    };
  }

  analyzeSimilarities(windows: WindowContent[]): SimilarityScore[] {
    const similarities: SimilarityScore[] = [];

    for (let i = 0; i < windows.length; i++) {
      for (let j = i + 1; j < windows.length; j++) {
        const similarity = this.calculateSimilarity(windows[i], windows[j]);
        if (similarity.score > 0.1) { // Only include significant similarities
          similarities.push(similarity);
        }
      }
    }

    return similarities.sort((a, b) => b.score - a.score);
  }
}

export const contentSimilarityAnalyzer = new ContentSimilarityAnalyzer();