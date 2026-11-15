import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TARGET_QUESTIONS } from './target-questions';
import { refResolver } from './refs';
import { Blocks, Rich, resolveBlocks } from './render';
import { BrandCitationStudy } from '../../etudes/[slug]/marque-citee';

describe('rendu des contenus', () => {
  it('Rich : liens internes et renvois numérotés', () => {
    const html = renderToStaticMarkup(<Rich text="Voir [le guide](/guides/x) [2]." />);
    expect(html).toContain('href="/guides/x"');
    expect(html).toContain('href="#source-2"');
  });

  it('chaque page « grande question » se rend sans renvoi non résolu', () => {
    for (const x of TARGET_QUESTIONS) {
      const { t } = refResolver();
      const html = renderToStaticMarkup(<>{x.sections.map((s) => <Blocks key={s.id} blocks={resolveBlocks(s.blocks, t)} />)}</>);
      expect(html, x.slug).not.toContain('[@');
      expect(html.length).toBeGreaterThan(500);
    }
  });

  it('l’étude se rend avec ses tableaux et sans renvoi non résolu', () => {
    const html = renderToStaticMarkup(<BrandCitationStudy />);
    expect(html).not.toContain('[@');
    expect(html).toContain('<table');
    expect(html).toContain('Niveau de preuve');
  });
});
