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

    // Check if string looks like an enum value (UPPER_CASE or UPPER_SNAKE_CASE)
    function isEnumLikeString(value: string): boolean {
      // Match patterns like: DRAFT, CONFIRMED, PAID_UPFRONT, NET_30
      return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(value);
    }

    // Get string value from literal node
    function getStringValue(node: TSESTree.Node): string | null {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        return node.value;
      }
      return null;
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

      // x === 'ENUM_VALUE' or x !== 'ENUM_VALUE'
      BinaryExpression(node) {
        if (node.operator !== '===' && node.operator !== '!==') {
          return;
        }

        // Check if either side is an enum-like string literal
        const leftValue = getStringValue(node.left);
        const rightValue = getStringValue(node.right);

        if (leftValue && isEnumLikeString(leftValue)) {
          context.report({
            node: node.left,
            messageId: 'hardcodedEnum',
          });
        }

        if (rightValue && isEnumLikeString(rightValue)) {
          context.report({
            node: node.right,
            messageId: 'hardcodedEnum',
          });
        }
      },

      // ['CONFIRMED', 'PARTIALLY_RECEIVED', ...]
      ArrayExpression(node) {
        // Only flag if array has > 1 element and ALL are enum-like strings
        if (node.elements.length <= 1) {
          return;
        }

        const allEnumLike = node.elements.every((el) => {
          if (!el) return false;
          const value = getStringValue(el);
          return value && isEnumLikeString(value);
        });

        if (allEnumLike) {
          context.report({
            node,
            messageId: 'hardcodedEnum',
          });
        }
      },

      // condition ? 'ENUM_A' : 'ENUM_B'
      ConditionalExpression(node) {
        const consequentValue = getStringValue(node.consequent);
        const alternateValue = getStringValue(node.alternate);

        // Flag if BOTH branches are enum-like strings
        if (
          consequentValue &&
          isEnumLikeString(consequentValue) &&
          alternateValue &&
          isEnumLikeString(alternateValue)
        ) {
          context.report({
            node,
            messageId: 'hardcodedEnum',
          });
        }
      },
    };
  },
});
