import React from 'react';
import type { LegalBlock, LegalSection } from '@/lib/legal/types';

/**
 * Renders the section tree of a legal document. Server component: there is
 * nothing interactive on a policy page, so none of this needs to ship to the
 * browser.
 */

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case 'text':
      return <p>{block.text}</p>;

    case 'note':
      return <strong className="legal-note">{block.text}</strong>;

    case 'list': {
      const items = block.items.map((item, i) => <li key={i}>{item}</li>);
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }

    case 'table':
      return (
        <div className="legal-table-wrap">
          <table>
            <thead>
              <tr>
                {block.columns.map((col, i) => (
                  // A column with no heading is a row label, not a header.
                  <th key={i} scope="col">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function DocumentBody({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="legal-body">
      {sections.map(section => (
        <section key={section.id} id={section.id}>
          <h2>{section.heading}</h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}
    </div>
  );
}
