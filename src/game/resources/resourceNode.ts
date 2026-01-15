import { ResourceNode, ResourceNodeType } from '../../types';
import { CONFIG } from '../../constants/config';
import { generateId } from '../../utils/math';

export function createResourceNode(
  type: ResourceNodeType,
  x: number,
  y: number
): ResourceNode {
  const config = CONFIG.RESOURCE_NODES[type];

  return {
    id: generateId(),
    type,
    x,
    y,
    amount: config.amount,
    maxAmount: config.amount,
  };
}

export function depleteResourceNode(
  node: ResourceNode,
  amount: number
): ResourceNode {
  return {
    ...node,
    amount: Math.max(0, node.amount - amount),
  };
}
