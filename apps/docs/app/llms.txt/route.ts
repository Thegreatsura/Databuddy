// Thanks to better-auth for the code

import * as fs from "node:fs/promises";
import fg from "fast-glob";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import { remarkInstall } from "fumadocs-docgen";
import remarkStringify from "remark-stringify";
import remarkMdx from "remark-mdx";

export const revalidate = false;

export async function GET() {
	// all scanned content
	const files = await fg(["./content/docs/**/*.mdx"]);

	const scan = files.map(async (file) => {
		const fileContent = await fs.readFile(file);
		const { content, data } = matter(fileContent.toString());

		const processed = await processContent(content);
		return `file: ${file}
meta: ${JSON.stringify(data, null, 2)}
        
${processed}`;
	});

	const scanned = await Promise.all(scan);

	return new Response(scanned.join("\n\n"));
}

async function processContent(content: string): Promise<string> {
	const file = await remark()
		.use(remarkMdx)
		// gfm styles
		.use(remarkGfm)
		// your remark plugins
		.use(remarkInstall, { persist: { id: "package-manager" } })
		// to string
		.use(remarkStringify)
		.process(content);

	return String(file);
}
