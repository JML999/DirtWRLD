import { PlayerEntityController, Vector3} from "hytopia";
import type { PlayerEntity, PlayerInput, PlayerCameraOrientation, Entity, World} from "hytopia";
import type { PlayerStateManager } from "./PlayerStateManager";
import type { PlayerState } from "./PlayerStateManager";
import type { PlayerUI } from "hytopia";
import type { Player } from "hytopia";
import * as math from './utils/math';
import type { DirtBlockManager } from "./dirtBlocks/DirtBlockManager";


export class MyPlayerController extends PlayerEntityController {
    private stateManager: PlayerStateManager;
    private dirtBlockManager: DirtBlockManager;
    private world: World;

    constructor(
        stateManager: PlayerStateManager,
        dirtBlockManager: DirtBlockManager,
        world: World
    ) {
        super();
        this.stateManager = stateManager;
        this.dirtBlockManager = dirtBlockManager;
        this.world = world;
    }

    onTick = (entity: Entity, deltaTimeMs: number): void => {
        const playerEntity = entity as PlayerEntity;
        if (!playerEntity.world) return;
        const state = this.stateManager.getState(playerEntity.player);
        if (!state) return;

        // Death check
        if (playerEntity.position.y < 0.9) {
            this.handlePlayerDeath(playerEntity);
            return;
        }
    }

    onTickWithPlayerInput = (entity: PlayerEntity, input: PlayerInput, cameraOrientation: PlayerCameraOrientation, deltaTimeMs: number): void => {
        if (!entity.world) return;
      //  const state = this.stateManager.getState(entity.player);
      //  if (!state) return;

        this.handleDigging(entity, input);
    }

    private handleDigging(entity: PlayerEntity, input: PlayerInput): void {
        if (!input.ml) return;
        const aimResult = this.calculateAimDirection(entity, 1.1);
        if (!aimResult) return;
        const raycastResult = this.world.simulation.raycast(
            aimResult.origin,
            aimResult.direction,
            1.1,
            { filterExcludeRigidBody: entity.rawRigidBody }
        );

        if (!raycastResult) { return; }
        let hitPointVector = new Vector3(raycastResult.hitPoint.x, raycastResult.hitPoint.y, raycastResult.hitPoint.z);
        if (raycastResult?.hitEntity) {
            this.dirtBlockManager.handleBlockHit(raycastResult.hitEntity.id?.toString() || '', hitPointVector, entity.player);
        }

    }

    // This is the aim direction for the player it cast a raycast from the center of the camera to find the target point
    // they it usess that point to aim from the players projectile spawn point - its super hacky rite now because
    // i cant get the correct direct /position of the camera is seems. or im dumb.
    protected calculateAimDirection(entity: PlayerEntity, maxDistance: number) { 
        // Get camera orientation
        const camera = entity.player.camera;
        const cameraPos = camera.attachedToEntity?.position;
        const cameraForward = Vector3.fromVector3Like(camera.facingDirection).normalize();

        // Get the vertical angle (pitch) of the camera
        const pitch = camera.orientation.pitch;


        // Project camera forward onto horizontal plane for consistent rotation
        const horizontalForward = new Vector3(
            cameraForward.x,
            0,  // Zero out Y component
            cameraForward.z
        );

        // Calculate right vector for camera offset
        const rightVector = new Vector3(
            -cameraForward.z,
            0,
            cameraForward.x
        ).normalize();

        // Use world up vector to rotate left
        const angleInRadians = -0.23 - pitch*pitch*0.15; 
        const rotatedHorizontal = math.rotateForwardVector(horizontalForward, angleInRadians);
        // Apply the same pitch to our rotated direction

        const finalDirection = new Vector3(
            rotatedHorizontal.x * Math.cos(pitch),
            Math.sin(pitch),
            rotatedHorizontal.z * Math.cos(pitch)
        ).normalize();

        if (!cameraPos) return;

        // Apply right offset only to camera/raycast position
        const rightOffset = camera.filmOffset * 0.038;
        const heightOffset = camera.offset.y ;
        let raycastPos = new Vector3(
            cameraPos.x + rightVector.x * rightOffset,
            cameraPos.y + heightOffset,
            cameraPos.z + rightVector.z * rightOffset
        );

        // Add forward offset based on zoom
        const forwardOffset = -camera.zoom/2;  // Adjust multiplier as needed
        raycastPos.add(Vector3.fromVector3Like(cameraForward).scale(forwardOffset));

        
        // Original projectile origin without right offset
        const originForwardOffset = 0.15;
        const origin = new Vector3(
            entity.position.x + finalDirection.x * originForwardOffset,
            entity.position.y + 0.35 + finalDirection.y * originForwardOffset,
            entity.position.z + finalDirection.z * originForwardOffset
        );
       
        const originOffset = 0.35;
        origin.x += rightVector.x * originOffset;
        origin.z += rightVector.z * originOffset;

        // Raycast from offset camera position
        const raycastResult = this.world?.simulation.raycast(
            raycastPos,
            finalDirection,
            maxDistance,
            { filterExcludeRigidBody: entity.rawRigidBody }
        );

        // If we hit nothing return the max distance point
        const targetPoint = raycastResult?.hitPoint ||
            new Vector3(raycastPos.x, raycastPos.y, raycastPos.z)
                .add(new Vector3(finalDirection.x, finalDirection.y, finalDirection.z).scale(maxDistance));

        // Projectiles Direction from player towards the target point
        const direction = new Vector3(
            targetPoint.x - origin.x,
            targetPoint.y - origin.y,
            targetPoint.z - origin.z
        );

        return { origin, direction };
    }

    private handlePlayerDeath(entity: PlayerEntity): void {
        entity.stopModelAnimations(['crawling']);
        entity.startModelLoopedAnimations(['idle']);
        entity.setPosition({ x: 0, y: 10, z: 0 });
        entity.rawRigidBody?.setLinearVelocity({ x: 0, y: 0, z: 0 });
        entity.rawRigidBody?.setGravityScale(1.0);
        entity.rawRigidBody?.setLinearDamping(0.0);
    }


    initPlayer(player: Player): void {
        // Setup UI handler
        player.ui.onData = (playerUI: PlayerUI, data: Record<string, any>) => {
            this.handleUIEvent(player, data);
        };
    }

    override attach(entity: Entity): void {
        super.attach(entity);
    }

    private handleUIEvent(player: Player, data: Record<string, any>): void {
        console.log('[Server] Received UI action:', data);

        switch (data.type) {
            case 'disablePlayerInput':
                console.log('[Server] Disabling player input');
                player.ui.lockPointer(false);
                break;

            case 'enablePlayerInput':
                console.log('[Server] Enabling player input');
                player.ui.lockPointer(true);
                break;

        }
    }

    override detach(entity: Entity): void {
        super.detach(entity);
        // Cleanup if needed
    }
}