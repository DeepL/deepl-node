// Copyright 2022 DeepL SE (https://www.deepl.com)
// Use of this source code is governed by an MIT
// license that can be found in the LICENSE file.

import { DeepLError } from './errors';
import { isString } from './utils';

/**
 * Stores the entries of a glossary.
 */
export class GlossaryEntries {
    private implEntries: Record<string, string>;

    /**
     * Construct a GlossaryEntries object containing the specified entries as an object or a
     * tab-separated values (TSV) string. The entries and tsv options are mutually exclusive.
     * @param options Controls how to create glossary entries. If options is unspecified, no
     *     entries will be created.
     * @param options.entries Object containing fields storing entries, for example:
     *     `{'Hello': 'Hallo'}`.
     * @param options.tsv String containing TSV to parse. Each line should contain a source and
     *     target term separated by a tab. Empty lines are ignored.
     * @return GlossaryEntries object containing parsed entries.
     * @throws DeepLError If given entries contain invalid characters.
     */
    constructor(options?: { tsv?: string; entries?: Record<string, string> }) {
        this.implEntries = {};

        if (options?.entries !== undefined) {
            if (options?.tsv !== undefined) {
                throw new DeepLError('options.entries and options.tsv are mutually exclusive');
            }
            Object.assign(this.implEntries, options.entries);
        } else if (options?.tsv !== undefined) {
            const tsv = options.tsv;
            for (const entry of tsv.split(/\r\n|\n|\r/)) {
                if (entry.length === 0) {
                    continue;
                }

                const [source, target, extra] = entry.split('\t', 3);
                if (target === undefined) {
                    throw new DeepLError(`Missing tab character in entry '${entry}'`);
                } else if (extra !== undefined) {
                    throw new DeepLError(`Duplicate tab character in entry '${entry}'`);
                }
                this.add(source, target, false);
            }
        }
    }

    /**
     * Add the specified source-target entry.
     * @param source Source term of the glossary entry.
     * @param target Target term of the glossary entry.
     * @param overwrite If false, throw an error if the source entry already exists.
     */
    public add(source: string, target: string, overwrite = false) {
        if (!overwrite && source in this.implEntries) {
            throw new DeepLError(`Duplicate source term '${source}'`);
        }
        this.implEntries[source] = target;
    }

    /**
     * Retrieve the contained entries.
     */
    public entries(): Record<string, string> {
        return this.implEntries;
    }

    /**
     * Converts glossary entries to a tab-separated values (TSV) string. Each term is trimmed of
     * leading and trailing whitespace, then validated; the trimmed term is what is written.
     * @return string containing entries in TSV format.
     * @throws {Error} If any glossary entries are invalid, for example empty after trimming.
     */
    public toTsv(): string {
        return Object.entries(this.implEntries)
            .map(([source, target]) => {
                const trimmedSource = source.trim();
                const trimmedTarget = target.trim();
                GlossaryEntries.validateGlossaryTerm(trimmedSource);
                GlossaryEntries.validateGlossaryTerm(trimmedTarget);
                return `${trimmedSource}\t${trimmedTarget}`;
            })
            .join('\n');
    }

    /**
     * Checks if the given glossary term contains any disallowed characters.
     * @param term Glossary term to check for validity.
     * @throws {Error} If the term is not valid or a disallowed character is found.
     */
    static validateGlossaryTerm(term: string) {
        if (!isString(term) || term.length === 0) {
            throw new DeepLError(`'${term}' is not a valid term.`);
        }
        for (let idx = 0; idx < term.length; idx++) {
            const charCode = term.charCodeAt(idx);
            if (
                (0 <= charCode && charCode <= 31) || // C0 control characters
                (128 <= charCode && charCode <= 159) || // C1 control characters
                charCode === 0x2028 ||
                charCode === 0x2029 // Unicode newlines
            ) {
                throw new DeepLError(
                    `Term '${term}' contains invalid character: '${term[idx]}' (${charCode})`,
                );
            }
        }
    }
}
