import { Entity, Audio, Vector3, World, Player, RigidBodyType, Quaternion, PlayerEntity } from 'hytopia';
import { PlayerStateManager } from './PlayerStateManager';
import type { VoidExpression } from 'typescript';

export class DirtGun extends Entity {
    private player: Player;
    private stateManager: PlayerStateManager;
    private shootSound: Audio;
    private _lastFireTime: number = 0;
    private fireRate: number = 10;

    constructor(world: World, entity: PlayerEntity, stateManager: PlayerStateManager) {
        super({
            name: 'DirtGun',
            modelUri: 'models/items/mud_cannon.gltf', // temporary model
            modelScale: 1.4,
            parent: entity,
            parentNodeName: 'hand_right_anchor'
        });

        this.player = entity.player;
        this.stateManager = stateManager;
        
        this.shootSound = new Audio({
            uri: 'audio/sfx/pistol-shoot.mp3',
            loop: false,
            volume: 0.7,
        });

        // Spawn the gun in the player's hand
        this.spawn(world, 
            { x: -0.04, y: 0.2, z: 0.5 }, // Adjusted position relative to hand
            Quaternion.fromEuler(-75, 0, 0) // Slightly adjusted rotation
        );
    }

    public processShoot(): boolean {
        const now = performance.now();
    
        if (this._lastFireTime && now - this._lastFireTime < 1000 / this.fireRate) {
          return false;
        }
    
        this._lastFireTime = now;
    
        return true;
      }


    shoot(origin: Vector3, direction: Vector3) {
        if (!this.world || !this.processShoot()) return;
        console.log('shooting');
        const playerState = this.stateManager.getState(this.player);
        if (!playerState || playerState.dirt < 5) return;


        // Deduct 5 dirt points
        this.stateManager.addDirtPoints(this.player, -5);

        const projectile = new Entity({
            blockTextureUri: 'blocks/dirtblocks/dirt_block_1',
            blockHalfExtents: { x: 0.5, y: 0.5, z: 0.5 }, 
            rigidBodyOptions: {
                type: RigidBodyType.DYNAMIC,
                gravityScale: 0.5
            }
          });

                  // Add collision handler for knockback
        projectile.onEntityCollision = (entity: Entity, otherEntity: Entity, started: boolean) => {
            if (started && otherEntity !== this.parent) {  // Don't knockback self
                // Apply knockback impulse
                otherEntity.applyImpulse({
                    x: direction.x * 30,
                    y: 15, // Upward force
                    z: direction.z * 30
                });
                
                // Destroy projectile on hit
                projectile.despawn();
            }
        };

        // Spawn and shoot
        projectile.spawn(this.world, origin);
        projectile.applyImpulse({
            x: direction.x * 50,
            y: direction.y * 50 + 20, // Added upward boost
            z: direction.z * 50
        });

        // Play sound
        this.shootSound.play(this.world, true);

        // Cleanup projectile after 3s
        setTimeout(() => {
            if (projectile.isSpawned) {
                projectile.despawn();
            }
        }, 3000);
    }
} 