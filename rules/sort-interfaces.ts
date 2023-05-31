import type { SortingNode } from '../typings'

import { AST_NODE_TYPES } from '@typescript-eslint/types'

import { createEslintRule } from '../utils/create-eslint-rule'
import { rangeToDiff } from '../utils/range-to-diff'
import { SortType, SortOrder } from '../typings'
import { sortNodes } from '../utils/sort-nodes'
import { complete } from '../utils/complete'
import { pairwise } from '../utils/pairwise'
import { compare } from '../utils/compare'

type MESSAGE_ID = 'unexpectedInterfacePropertiesOrder'

type Options = [
  Partial<{
    order: SortOrder
    type: SortType
  }>,
]

export const RULE_NAME = 'sort-interfaces'

export default createEslintRule<Options, MESSAGE_ID>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce sorted interface properties',
      recommended: false,
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          type: {
            enum: [
              SortType.alphabetical,
              SortType.natural,
              SortType['line-length'],
            ],
            default: SortType.natural,
          },
          order: {
            enum: [SortOrder.asc, SortOrder.desc],
            default: SortOrder.asc,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unexpectedInterfacePropertiesOrder:
        'Expected "{{second}}" to come before "{{first}}"',
    },
  },
  defaultOptions: [
    {
      type: SortType.alphabetical,
      order: SortOrder.asc,
    },
  ],
  create: context => ({
    TSInterfaceBody: node => {
      let options = complete(context.options.at(0), {
        type: SortType.alphabetical,
        order: SortOrder.asc,
      })

      if (node.body.length > 1) {
        let source = context.getSourceCode()

        let nodes: SortingNode[] = node.body.map(element => {
          let name: string

          if (element.type === AST_NODE_TYPES.TSPropertySignature) {
            if (element.key.type === AST_NODE_TYPES.Identifier) {
              ;({ name } = element.key)
            } else if (element.key.type === AST_NODE_TYPES.Literal) {
              name = `${element.key.value}`
            } else {
              let end: number

              if (element.typeAnnotation?.range.at(0)) {
                end = element.typeAnnotation.range.at(0)!
              } else {
                let optional = element.optional ? '?'.length : 0
                end = element.range.at(1)! - optional
              }

              name = source.text.slice(element.range.at(0), end)
            }
          } else if (element.type === AST_NODE_TYPES.TSIndexSignature) {
            name = source.text.slice(
              element.range.at(0),
              element.typeAnnotation?.range.at(0) ?? element.range.at(1),
            )
          } else {
            name = source.text.slice(
              element.range.at(0),
              element.returnType?.range.at(0) ?? element.range.at(1),
            )
          }

          return {
            size: rangeToDiff(element.range),
            node: element,
            name,
          }
        })

        pairwise(nodes, (first, second) => {
          if (compare(first, second, options)) {
            context.report({
              messageId: 'unexpectedInterfacePropertiesOrder',
              data: {
                first: first.name,
                second: second.name,
              },
              node: second.node,
              fix: fixer =>
                sortNodes(fixer, {
                  options,
                  source,
                  nodes,
                }),
            })
          }
        })
      }
    },
  }),
})
