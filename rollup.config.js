import postcss from "rollup-plugin-postcss";
import { terser } from "rollup-plugin-terser";
import typescript from "@rollup/plugin-typescript";

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.esm.js",
        format: "esm",
        sourcemap: true,
      },
      {
        file: "dist/index.umd.js",
        format: "umd",
        name: "leopard",
        sourcemap: true,
      },
    ],
    plugins: [
      typescript(),
      terser({
        output: {
          comments: (node, comment) => {
            // Keep license comments in the minified output
            if (comment.type === "comment2") {
              return /license/i.test(comment.value);
            }
            return false;
          },
        },
      }),
    ],
  },
  {
    input: "src/index.css",
    output: {
      file: "dist/index.min.css",
    },
    plugins: [
      postcss({
        modules: false,
        extract: true,
        minimize: true,
      }),
    ],
  },
];
