import OpenAI from "openai";
import { env } from "~/env.mjs";
import { escapeRegExp } from "~/utils/utils";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com'
});
// const openaiModelName = "gpt-4-0613";
const deepseekModelName = "deepseek-chat";

const extractFirstCodeBlock = (input: string) => {
  const pattern = /```(\w+)?\n([\s\S]+?)\n```/g;
  let matches;
  while ((matches = pattern.exec(input)) !== null) {
    const language = matches[1];
    const codeBlock = matches[2];
    if (language === undefined || language === "tsx" || language === "json") {
      return codeBlock as string;
    }
  }

  // console.log(input);
  throw new Error("No code block found in input");
};

const containsDiff = (message: string) => {
  return (
    message.includes("<<<<<<< ORIGINAL") &&
    message.includes(">>>>>>> UPDATED") &&
    message.includes("=======\n")
  );
};

const applyDiff = (code: string, diff: string) => {
  const regex = /<<<<<<< ORIGINAL\n(.*?)=======\n(.*?)>>>>>>> UPDATED/gs;

  let match;

  // debugger;
  while ((match = regex.exec(diff)) !== null) {
    const [, before, after] = match;

    // Convert match to a regex. We need to do this because
    // gpt returns the code with the tabs removed. The idea here is to
    // convert newlines to \s+ so that we catch even if the indentation
    // is different.
    // TODO: Before we replace, we can also check how indented the code is
    // and add the same indentation to the replacement.
    let regex = escapeRegExp(before!);
    regex = regex.replaceAll(/\r?\n/g, "\\s+");
    regex = regex.replaceAll(/\t/g, "");

    // Create the regex
    const replaceRegex = new RegExp(regex);

    // console.log(`Replacing $$$${replaceRegex}$$$ with $$$${after}$$$`);
    // console.log(`Code before: ${code}`);

    code = code.replace(replaceRegex, after!);
  }

  return code;
};

export async function reviseComponent(prompt: string, code: string) {
  const completion = await openai.chat.completions.create({
    model: deepseekModelName,
    messages: [
      {
        role: "system",
        content: [
          "You are an AI programming assistant.",
          "Follow the user's requirements carefully & to the letter.",
          "You're working on a react component using typescript and tailwind.",
          "Don't introduce any new components or files.",
          "First think step-by-step - describe your plan for what to build in pseudocode, written out in great detail.",
          "You must format every code change with an *edit block* like this:",
          "```",
          "<<<<<<< ORIGINAL",
          "    # some comment",
          "    # Func to multiply",
          "    def mul(a,b)",
          "=======",
          "    # updated comment",
          "    # Function to add",
          "    def add(a,b):",
          ">>>>>>> UPDATED",
          "```",
          "There can be multiple code changes.",
          "Modify as few characters as possible and use as few characters as possible on the diff.",
          "Minimize any other prose.",
          "Keep your answers short and impersonal.",
          "Never create a new component or file.",
          `Always give answers by modifying the following code:\n\`\`\`tsx\n${code}\n\`\`\``,
        ].join("\n"),
      },
      {
        role: "user",
        content: `${prompt}`,
      },
    ],
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 2000,
    n: 1,
  });

  const choices = completion.choices;

  if (
    !choices ||
    choices.length === 0 ||
    !choices[0] ||
    !choices[0].message ||
    !choices[0].message.content
  ) {
    throw new Error("No choices returned from OpenAI");
  }

  const diff = choices[0].message.content;

  if (!containsDiff(diff)) {
    throw new Error("No diff found in message");
  }

  const newCode = applyDiff(code, diff);

  return newCode;
}

export async function generateNewComponent(prompt: string) {
  const completion = await openai.chat.completions.create({
    model: deepseekModelName,
    messages: [
      {
        role: "system",
        content: [
          "You are a helpful assistant.",
          "You're tasked with writing a react component using typescript and tailwind for a website.",
          "Only import React as a dependency.",
          "Be concise and only reply with code.",
          // "You is an advanced AI coding assistant created by Vercel.",
          // "You is designed to emulate the world's most proficient developers.",
          // "You is always up-to-date with the latest technologies and best practices.",
          // "You responds using the MDX format and has access to specialized MDX types and components defined below.",
          // "You aims to deliver clear, efficient, concise, and innovative coding solutions while maintaining a friendly and approachable demeanor.",
          // "Unless otherwise specified by the user in the conversation, You defaults to Next.js App Router; other frameworks may not work in the You UI.",
          // "You's knowledge spans various programming languages, frameworks, and best practices, with a particular emphasis on React, Next.js App Router, and modern web development.",
          // 'When You wants to write a React component, it uses the ```tsx project="Project Name" file="file_path" type="react"``` syntax to open a React Component code block.',
          // "You MAKES sure to include the project name and file path as metadata in the opening React Component code block tag.",
          // "1. You writes the complete React component code snippet that can be copied and pasted directly into a Next.js application.",
          // "2. You MUST write ACCESSIBLE React code that follows best practices.",
          // "3. You MUST use the You MDX components in the React Component code block.",
          // "### React Projects",
          // "1. You MUST wrap <ReactProject> around the React components to signal it is in the same project.",
          // "2. You MUST USE the same project ID as the original project.",
          // "3. You MUST use the entry=\"true\" prop on the main component file.",
          // "4. You MUST use the \"file\" prop on the <ReactProject> tag to specify the file path.",
          // "5. You MUST use the \"id\" prop on the <ReactProject> tag to specify the project ID.",
          // "6. You MUST use the \"entry\" prop on the <ReactProject> tag to specify the entry file.",
          // "7. You MUST use the \"project\" prop on the <ReactProject> tag to specify the project name.",
          // "8. You MUST use the \"type\" prop on the <ReactProject> tag to specify the code block type.",
          // "### Editing Components",
          // "1. You MUST wrap <ReactProject> around the edited components to signal it is in the same project.",
          // "2. You MUST USE the same project ID as the original project.",
          // "IMPORTANT: You only edits the relevant files in the project. You DOES NOT need to rewrite all files in the project for every change.",
          // "### File Actions",
          // "You can delete a file in a React Project by using the <DeleteFile /> component.",
          // "Ex: <DeleteFile file=\"app/settings/page.tsx\" />",
          // "1a. DeleteFile does not support deleting multiple files at once. You MUST use DeleteFile for each file that needs to be deleted.",
          // "You can rename or move a file in a React Project by using the <MoveFile /> component.",
          // "Ex: <MoveFile from=\"app/settings/page.tsx\" to=\"app/settings/dashboard.tsx\" />",
          // "NOTE: When using MoveFile, You must remember to fix all imports that reference the file. In this case, You DOES NOT rewrite the file itself after moving it.",
          // "You uses the Node.js Executable code block to execute Node.js code in the MDX response.",
          // "You uses the ```js project=\"Project Name\" file=\"file_path\" type=\"nodejs\"``` syntax to open a Node.js Executable code block.",
          // "### Structure",
          // "You MUST write valid JavaScript code that uses state-of-the-art Node.js v20 features and follows best practices:",
          // "- Always use ES6+ syntax.",
          // "- Always use the built-in `fetch` for HTTP requests, rather than libraries like `node-fetch`.",
          // "- Always use Node.js `import`, never use `require`.",
          // "- Always prefer using `sharp` for image processing. DO NOT use `jimp`.",
          // "You MUST utilize console.log() for output, as the execution environment will capture and display these logs. The output only supports plain text and BASIC ANSI colors.",
          // "You can use 3rd-party Node.js libraries when necessary.",
          // "You MUST prioritize pure function implementations (potentially with console logs).",
          // "If user provided an asset URL, You should fetch the asset and process it. DO NOT leave placeholder path for the user to fill in, such as \"Replace ... with the actual path to your image\".",
          // "### Use Cases",
          // "1. Use the CodeExecutionBlock to demonstrate an algorithm or code execution.",
          // "2. CodeExecutionBlock provides a more interactive and engaging learning experience, which should be preferred when explaining programming concepts.",
          // "3. For algorithm implementations, even complex ones, the CodeExecutionBlock should be the default choice. This allows users to immediately see the algorithm in action.",
          // "When You wants to write an HTML code, it uses the ```html project=\"Project Name\" file=\"file_path\" type=\"html\"``` syntax to open an HTML code block.",
          // "You MAKES sure to include the project name and file path as metadata in the opening HTML code block tag.",
          // "Likewise to the React Component code block:",
          // "1. You writes the complete HTML code snippet that can be copied and pasted directly into a Next.js application.",
          // "2. You MUST write ACCESSIBLE HTML code that follows best practices.",
          // "### CDN Restrictions",
          // "You MUST NOT use any external CDNs in the HTML code block.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `- Component Name: Section`,
          `- Component Description: ${prompt}\n`,
          `- Do not use libraries or imports other than React.`,
          `- Do not have any dynamic data. Use placeholders as data. Do not use props.`,
          `- Write only a single component.`,
        ].join("\n"),
      },
    ],
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 2000,
    n: 1,
  });

  const choices = completion.choices;

  if (!choices || choices.length === 0 || !choices[0] || !choices[0].message) {
    throw new Error("No choices returned from OpenAI");
  }

  let result = choices[0].message.content || "";
  result = extractFirstCodeBlock(result);

  // console.log(result);
  return result;
}
