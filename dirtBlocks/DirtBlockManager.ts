import { Entity, World, Vector3, RigidBodyType, Player } from "hytopia";
import { BlOCK_SPAWN_LOCATIONS } from './DirtCordinates';
import { PlayerStateManager } from "../PlayerStateManager";

interface DirtBlock {
    entity: Entity;
    spawnTime: number;
    dirtType: string;
    amount: number;
    health: number;
    position: Vector3;
}

interface ZoneSpawnState {
    activeBlocks: number;
    coordinates: Vector3[];
    usedCoordinates: Set<string>;
}

export class DirtBlockManager {
    private baitBlocks: Map<string, DirtBlock> = new Map();
    private zoneStates: Map<string, ZoneSpawnState> = new Map();
    private maxBlocksPerZone = 10;
    private world: World;
    private stateManager: PlayerStateManager;
    
    constructor(world: World, stateManager: PlayerStateManager) {
        this.world = world;
        this.initializeZoneStates();
        this.spawnInitialBlocks();
        this.stateManager = stateManager;
    }

    private initializeZoneStates() {
        BlOCK_SPAWN_LOCATIONS.forEach(zone => {
            this.zoneStates.set(zone.id, {
                activeBlocks: 0,
                coordinates: zone.coordinates,
                usedCoordinates: new Set()
            });
        });
    }

    public spawnInitialBlocks() {
        BlOCK_SPAWN_LOCATIONS.forEach(zone => {
            for (let i = 0; i < this.maxBlocksPerZone; i++) {
                this.spawnBlockInZone(zone.id);
            }
        });
    }

    private spawnBlockInZone(zoneId: string): boolean {
        const zoneState = this.zoneStates.get(zoneId);
        const zone = BlOCK_SPAWN_LOCATIONS.find(z => z.id === zoneId);
        
        if (!zoneState || !zone || zoneState.activeBlocks >= this.maxBlocksPerZone) {
            return false;
        }

        const availableCoords = zone.coordinates.filter(coord => 
            !zoneState.usedCoordinates.has(`${coord.x},${coord.y},${coord.z}`));

        if (availableCoords.length === 0) {
            zoneState.usedCoordinates.clear();
            return false;
        }

        const randomIndex = Math.floor(Math.random() * availableCoords.length);
        const position = availableCoords[randomIndex];

        const block = this.createDirtBlock(position);
        if (block.entity.id) {
            this.baitBlocks.set(block.entity.id.toString(), block);
            zoneState.activeBlocks++;
            zoneState.usedCoordinates.add(`${position.x},${position.y},${position.z}`);
            return true;
        }
        return false;
    }

    private balanceZones() {
        let lowestFillPercentage = 1;
        let zoneToSpawnIn = null;

        this.zoneStates.forEach((state, zoneId) => {
            const fillPercentage = state.activeBlocks / this.maxBlocksPerZone;
            if (fillPercentage < lowestFillPercentage) {
                lowestFillPercentage = fillPercentage;
                zoneToSpawnIn = zoneId;
            }
        });

        if (zoneToSpawnIn) {
            this.spawnBlockInZone(zoneToSpawnIn);
        }
    }

    private createDirtBlock(position: Vector3): DirtBlock {
        const entity = new Entity({
            blockTextureUri: 'blocks/dirt.png',
            blockHalfExtents: { x: 0.5, y: 0.5, z: 0.5 },
            rigidBodyOptions: {
                type: RigidBodyType.DYNAMIC,
            }
        });

        entity.spawn(this.world, position);
        console.log(`Bait block spawned at ${position}`);


        return {
            entity,
            spawnTime: Date.now(),
            dirtType: 'dirt',
            amount: 1,
            health: 3,
            position
        };
    }

    private removeDirtBlock(id: string) {
        const block = this.baitBlocks.get(id);
        if (block) {
            block.entity.despawn();
            this.baitBlocks.delete(id);
        }
    }

    private giveDirtToPlayer(player: Player, dirtType: string, amount: number) {
        // Add to player's inventory
        console.log(`Giving ${amount} ${dirtType} to player`);
        // TODO: Integrate with inventory system
    }

    public handleBlockHit(entityId: string, hitPosition: Vector3, player: Player): void {
        const block = this.baitBlocks.get(entityId);
        if (!block) return;

        block.health--;
        this.spawnBreakParticles(block.entity);
        
        // Add dirt points on each hit
        this.stateManager.addDirtPoints(player, 20);

        if (block.health <= 0) {
            const zoneId = this.findZoneForBlock(entityId);
            if (zoneId) {
                const zoneState = this.zoneStates.get(zoneId);
                if (zoneState) {
                    zoneState.activeBlocks--;
                }
            }
            this.removeDirtBlock(entityId);
            this.giveDirtToPlayer(player, block.dirtType, block.amount);
            this.balanceZones();
        }
    }

    private findZoneForBlock(entityId: string): string | null {
        const block = this.baitBlocks.get(entityId);
        if (!block) return null;

        return BlOCK_SPAWN_LOCATIONS.find(zone => 
            zone.coordinates.some(coord => 
                coord.x === block.position.x && 
                coord.y === block.position.y && 
                coord.z === block.position.z
            ))?.id || null;
    }

    private spawnBreakParticles(box: Entity) {
        const particleCount = 3;

        for (let i = 0; i < particleCount; i++) {
           
            const particle = new Entity({
                blockTextureUri: "blocks/dirt.png",
                blockHalfExtents: { x: 0.05, y: 0.05, z: 0.05 },
                rigidBodyOptions: {
                    type: RigidBodyType.DYNAMIC,
                }
            });
    
            // Random edge position
            const edge = Math.floor(Math.random() * 4); // 0-3 for four edges
            const offset = Math.random() * 0.8 - 0.4;   // -0.4 to 0.4
            
            const particlePos = new Vector3(
                box.position.x + (edge % 2 === 0 ? offset : (edge === 1 ? 0.4 : -0.4)),
                box.position.y + 0.4,  // Top of box
                box.position.z + (edge % 2 === 1 ? offset : (edge === 0 ? 0.4 : -0.4))
            );
            
            console.log("particlePos", particlePos);
            particle.spawn(this.world, particlePos);
    
            setTimeout(() => {
                if (particle.isSpawned) {
                    particle.despawn();
                }
            }, 500);
        }
    }
}