import { Unit, ResourceNode, Resources } from '../../types';
import { distance } from '../../utils/math';

export interface SupportUpdateResult {
  unit: Unit;
  resourceGathered?: { type: keyof Resources; amount: number; nodeId: string };
  crystalFound?: boolean;
}

export function updateSupportUnit(
  unit: Unit,
  deltaTime: number,
  resourceNodes: ResourceNode[]
): SupportUpdateResult {
  const config = unit.config;
  const resourceType = config.resource;
  const gatherRate = config.gatherRate || 1;

  let updatedUnit = { ...unit };
  let resourceGathered: { type: keyof Resources; amount: number; nodeId: string } | undefined;
  let crystalFound = false;

  // 해당 유닛이 채집할 수 있는 자원 노드 찾기
  let nearestNode: ResourceNode | null = null;
  let minDist = Infinity;

  for (const node of resourceNodes) {
    // 자원 타입 매칭
    const canGather =
      (node.type === 'tree' && resourceType === 'wood') ||
      (node.type === 'rock' && resourceType === 'stone') ||
      (node.type === 'herb' && resourceType === 'herb') ||
      (node.type === 'crystal' && resourceType === 'herb') || // 채집꾼은 수정도 채집 가능
      (node.type === 'goldmine' && resourceType === 'gold'); // 금광부는 광산에서 채집

    if (canGather && node.amount > 0) {
      const dist = distance(unit.x, unit.y, node.x, node.y);
      if (dist < minDist) {
        minDist = dist;
        nearestNode = node;
      }
    }
  }

  if (nearestNode && minDist > 30) {
    // 자원으로 이동
    const angle = Math.atan2(nearestNode.y - unit.y, nearestNode.x - unit.x);
    updatedUnit.x += Math.cos(angle) * config.speed;
    updatedUnit.y += Math.sin(angle) * config.speed;
    updatedUnit.state = 'moving';
  } else if (nearestNode) {
    // 채집
    updatedUnit.state = 'gathering';
    const gatherAmount = gatherRate * deltaTime;

    if (nearestNode.amount >= gatherAmount) {
      // 자원 타입 결정
      let gatheredType: keyof Resources;
      if (nearestNode.type === 'tree') {
        gatheredType = 'wood';
      } else if (nearestNode.type === 'rock') {
        gatheredType = 'stone';
      } else if (nearestNode.type === 'herb') {
        gatheredType = 'herb';
        // 수정 발견 확률 (채집꾼만)
        if (resourceType === 'herb' && Math.random() < 0.001) {
          crystalFound = true;
        }
      } else if (nearestNode.type === 'goldmine') {
        gatheredType = 'gold';
      } else {
        gatheredType = 'crystal';
      }

      resourceGathered = {
        type: gatheredType,
        amount: gatherAmount,
        nodeId: nearestNode.id,
      };
    }
  } else {
    updatedUnit.state = 'idle';
  }

  return { unit: updatedUnit, resourceGathered, crystalFound };
}
