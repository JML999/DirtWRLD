import {
    Audio,
    Entity,
    PathfindingEntityController,
    PlayerEntity,
  } from 'hytopia';

  import type { EntityOptions } from 'hytopia';
  
  import type { QuaternionLike, Vector3Like, World } from 'hytopia';
  
  
  const RETARGET_ACCUMULATOR_THRESHOLD_MS = 5000;
  const PATHFIND_ACCUMULATOR_THRESHOLD_MS = 3000;
  
  export interface EnemyEntityOptions extends EntityOptions {
    damage: number;
    damageAudioUri?: string;
    health: number;
    idleAudioUri?: string;
    idleAudioReferenceDistance?: number;
    idleAudioVolume?: number;
    jumpHeight?: number
    preferJumping?: boolean;
    reward: number;
    speed: number;
  }
  
  export default class EnemyEntity extends Entity {
    public damage: number;
    public health: number;
    public jumpHeight: number;
    public maxHealth: number;
    public preferJumping: boolean;
    public reward: number;
    public speed: number;
  
    private _damageAudio: Audio | undefined;
    private _idleAudio: Audio | undefined;
    private _isPathfinding = false;
    private _pathfindAccumulatorMs = 0;
    private _retargetAccumulatorMs = 0;
    private _targetEntity: Entity | undefined;
  
    public constructor(options: EnemyEntityOptions) {
      super(options);
      this.damage = options.damage;
      this.health = options.health;
      this.jumpHeight = options.jumpHeight ?? 1;
      this.maxHealth = options.health;
      this.preferJumping = options.preferJumping ?? false;
      this.reward = options.reward;
      this.speed = options.speed;
  
      if (options.damageAudioUri) {
        this._damageAudio = new Audio({
          attachedToEntity: this,
          uri: options.damageAudioUri,
          volume: 1,
          loop: false,
        });
      }
  
      if (options.idleAudioUri) {
        this._idleAudio = new Audio({
          attachedToEntity: this,
          uri: options.idleAudioUri,
          volume: options.idleAudioVolume ?? 0.5,
          loop: true,
          referenceDistance: options.idleAudioReferenceDistance ?? 1, // low reference distance so its only heard when the enemy is very near
        });
      }
  
      this.onEntityCollision = this._onEntityCollision;
      this.onTick = this._onTick;
  
      this.setCcdEnabled(true);
    }
  
    public override spawn(world: World, position: Vector3Like, rotation?: QuaternionLike) {
      super.spawn(world, position, rotation);
  
      if (this._idleAudio) {
        this._idleAudio.play(world, true);
      }
    }
  
  
    private _onEntityCollision = (entity: Entity, otherEntity: Entity, started: boolean) => {
      if (!started || !(otherEntity instanceof PlayerEntity)) {
        return;
      }

      // Calculate direction from enemy to player
      const directionToPlayer = {
        x: otherEntity.position.x - this.position.x,
        y: 0,
        z: otherEntity.position.z - this.position.z
      };

      // Normalize the direction
      const distance = Math.sqrt(directionToPlayer.x * directionToPlayer.x + directionToPlayer.z * directionToPlayer.z);
      const knockback = {
        x: (directionToPlayer.x / distance) * 10,
        y: 5, // Fixed upward force
        z: (directionToPlayer.z / distance) * 10
      };

      // Apply knockback
      otherEntity.applyImpulse(knockback);
    }
  
    /*
     * Pathfinding is handled on an accumulator basis to prevent excessive pathfinding
     * or movement calculations. It defers to dumb movements 
     */
    private _onTick = (entity: Entity, tickDeltaMs: number) => {
      if (!this.isSpawned) {
        return;
      }
  
      this._pathfindAccumulatorMs += tickDeltaMs;
      this._retargetAccumulatorMs += tickDeltaMs;
  
      // Acquire a target to hunt
      if (!this._targetEntity || !this._targetEntity.isSpawned || this._retargetAccumulatorMs > RETARGET_ACCUMULATOR_THRESHOLD_MS) {
        this._targetEntity = this._getNearestTarget();
        this._retargetAccumulatorMs = 0;
      }
  
      // No target, do nothing
      if (!this._targetEntity) {
        return;
      }
  
      const targetDistance = this._getTargetDistance(this._targetEntity);
      const pathfindingController = this.controller as PathfindingEntityController;
  
      if (targetDistance < 8 || (!this._isPathfinding && this._pathfindAccumulatorMs < PATHFIND_ACCUMULATOR_THRESHOLD_MS)) {
        pathfindingController.move(this._targetEntity.position, this.speed);
        pathfindingController.face(this._targetEntity.position, this.speed * 2);
      } else if (this._pathfindAccumulatorMs > PATHFIND_ACCUMULATOR_THRESHOLD_MS) {
        this._isPathfinding = pathfindingController.pathfind(this._targetEntity.position, this.speed, {
          maxFall: this.jumpHeight,
          maxJump: this.jumpHeight,
          maxOpenSetIterations: 200,
          verticalPenalty: this.preferJumping ? -1 : 1,
          pathfindAbortCallback: () => this._isPathfinding = false,
          pathfindCompleteCallback: () => this._isPathfinding = false,
          waypointMoveSkippedCallback: () => this._isPathfinding = false,
        });
  
        this._pathfindAccumulatorMs = 0;
      }

      // Death check
      if (this.position.y < 0) {
        this.handleZombieDeath();
        return;
       }
    }

    private handleZombieDeath() {
        this.despawn();
    }
  
    private _getNearestTarget(): Entity | undefined {
      if (!this.world) {
        return undefined;
      }
  
      let nearestTarget: Entity | undefined;
      let nearestDistance = Infinity;
  
      const targetableEntities = this.world.entityManager.getAllPlayerEntities();
  
      targetableEntities.forEach(target => {        
        const distance = this._getTargetDistance(target);
        if (distance < nearestDistance) {
          nearestTarget = target;
          nearestDistance = distance;
        }
      });
  
      return nearestTarget;
    }
  
    private _getTargetDistance(target: Entity) {
      const targetDistance = {
        x: target.position.x - this.position.x,
        y: target.position.y - this.position.y,
        z: target.position.z - this.position.z,
      };
  
      return Math.sqrt(targetDistance.x * targetDistance.x + targetDistance.y * targetDistance.y + targetDistance.z * targetDistance.z);
    }
  }
  