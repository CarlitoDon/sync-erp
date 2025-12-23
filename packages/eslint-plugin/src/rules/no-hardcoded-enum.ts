import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';

export const noHardcodedEnum = ESLintUtils.RuleCreator(
  (name) => `https://internal/${name}`
)({
  name: 'no-hardcoded-enum',
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded enum-like typing',
    },
    messages: {
      hardcodedEnum:
        'Hardcoded enum detected. Import enum from @repo/shared instead.',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function isStringLiteral(node: TSESTree.Node) {
      return (
        (node.type === 'Literal' && typeof node.value === 'string') ||
        node.type === 'TemplateLiteral' // Also catch backticked strings if simple
      );
    }

    return {
      // z.enum(['A', 'B'])
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'enum'
        ) {
          const arg = node.arguments[0];
          if (
            arg?.type === 'ArrayExpression' &&
            arg.elements.every((el) => el && isStringLiteral(el))
          ) {
            context.report({
              node,
              messageId: 'hardcodedEnum',
            });
          }
        }
      },

      // type X = 'A' | 'B'
      TSUnionType(node) {
        if (
          node.types.every(
            (t) =>
              t.type === 'TSLiteralType' &&
              t.literal.type === 'Literal' &&
              typeof t.literal.value === 'string'
          )
        ) {
          // Additional heuristic: only flag if union has > 1 members to allow simple single-literal types
          if (node.types.length > 1) {
            context.report({
              node,
              messageId: 'hardcodedEnum',
            });
          }
        }
      },
    };
  },
});
