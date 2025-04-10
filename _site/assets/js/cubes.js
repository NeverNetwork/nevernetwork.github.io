import * as THREE from 'three';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

let container;
let camera, controls, scene, renderer;
let pickingTexture, pickingScene;
let highlightBox;
let pickedId = -1;
let selectedCubeId = -1;  // Track the currently selected cube
let lastInteractionTime = 0;
let lastTime = 0;
let autoRotating = true;
const fragments = [];
const gravity = new THREE.Vector3(0, -0.015, 0);
const pointer = new THREE.Vector2();
const offset = new THREE.Vector3(10, 10, 10);
const clearColor = new THREE.Color();
let lastClickedCube = null;
let lastClickTime = 0;
let pointerStartPosition = new THREE.Vector2();
let hasMoved = false;
const MOVE_THRESHOLD = 5; // pixels

// Export constants and mappings
export const cubeBlogMappings = {};
export const INTERACTION_TIMEOUT = 500;
export const INACTIVITY_TIMEOUT = 10000;
export const AUTO_ROTATION_SPEED = 0.2;
export const pickingData = [];

// Export functions
export { init, setupOverlays, startAutoRotation, stopAutoRotation, closeMenu, checkInactivity, showBlogPost, destroyCube, showCubeMenu, resetCubeColors };

function startAutoRotation() {
    autoRotating = true;
    // Close menu when auto-rotation starts
    const menu = document.getElementById('cube-menu');
    menu.style.display = 'none';
    selectedCubeId = -1;
    highlightBox.visible = false;
}

function stopAutoRotation() {
    autoRotating = false;
    lastInteractionTime = Date.now();
}

function closeMenu() {
    const menu = document.getElementById('cube-menu');
    menu.style.display = 'none';
    selectedCubeId = -1;
    highlightBox.visible = false;
}

function checkInactivity() {
    if (!autoRotating && Date.now() - lastInteractionTime > INACTIVITY_TIMEOUT) {
        startAutoRotation();
    }
}

class Fragment {
    constructor(geometry, material, position, velocity, rotation, customGravity = gravity) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.velocity = velocity;
        this.rotation = rotation;
        this.gravity = customGravity;
        scene.add(this.mesh);
    }

    update() {
        this.velocity.add(this.gravity);
        this.mesh.position.add(this.velocity);
        this.mesh.rotation.x += this.rotation.x;
        this.mesh.rotation.y += this.rotation.y;
        this.mesh.rotation.z += this.rotation.z;

        // Remove if fallen below certain point
        if (this.mesh.position.y < -2000) {
            scene.remove(this.mesh);
            return true;
        }
        return false;
    }
}

function setupOverlays() {
    setupBlogOverlay();
    setupCubeMenu();
    setupHamburgerMenu();
}

function setupBlogOverlay() {
    const overlay = document.getElementById('blog-overlay');
    const closeButton = document.querySelector('.close-button');
    
    closeButton.addEventListener('click', () => {
        overlay.classList.remove('visible');
    });
}

function setupCubeMenu() {
    const menu = document.getElementById('cube-menu');
    const readButton = document.getElementById('read-button');

    readButton.addEventListener('click', () => {
        closeMenu();
        showBlogPost();
    });

    // Close menu when clicking outside both menu and renderer
    document.addEventListener('click', (event) => {
        if (!menu.contains(event.target) && event.target !== renderer.domElement) {
            closeMenu();
        }
    });
}

function setupHamburgerMenu() {
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const slideMenu = document.querySelector('.slide-menu');
    const menuOverlay = document.querySelector('.menu-overlay');

    hamburgerBtn.addEventListener('click', () => {
        slideMenu.classList.toggle('active');
        menuOverlay.classList.toggle('active');
    });

    menuOverlay.addEventListener('click', () => {
        slideMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
    });
}

function showBlogPost() {
    const blogOverlay = document.getElementById('blog-overlay');
    const blogText = document.getElementById('blog-text');
    
    if (pickedId in cubeBlogMappings) {
        const post = cubeBlogMappings[pickedId];
        
        // Create and set the blog post content
        const content = `
            <article class="post">
                <header class="post-header">
                    <h1 class="post-title">${post.title}</h1>
                    <p class="post-meta">
                        <time datetime="${post.date}">${post.date}</time>
                        <span class="post-author">${post.author}</span>
                    </p>
                </header>
                <div class="post-content">
                    <p>${post.brief}</p>
                    ${post.content || ''}
                </div>
            </article>
        `;
        
        blogText.innerHTML = content;
    } else {
        // Show "no post assigned" message
        blogText.innerHTML = `
            <article class="post">
                <header class="post-header">
                    <h1 class="post-title">No Post Assigned</h1>
                </header>
                <div class="post-content">
                    <p>This cube doesn't have a blog post assigned to it yet. Check back later for new content!</p>
                </div>
            </article>
        `;
    }
    
    blogOverlay.classList.remove('hidden');
    blogOverlay.classList.add('visible');
}

function destroyCube(id) {
    const data = pickingData[id];
    if (!data) return;

    // Mark cube as destroyed
    data.destroyed = true;

    // Find and remove the original cube from the merged geometry
    scene.traverse((object) => {
        if (object.isMesh && object.geometry.attributes.id) {
            const ids = object.geometry.attributes.id.array;
            const vertices = object.geometry.attributes.position;
            const colors = object.geometry.attributes.color;
            const indices = object.geometry.index ? object.geometry.index.array : null;
            
            // Find the cube's vertices
            for (let i = 0; i < vertices.count; i += 24) {  // 24 vertices per cube
                if (ids[i] === id) {
                    // Scale vertices to 0 to effectively remove them
                    for (let j = 0; j < 24; j++) {
                        const idx = i + j;
                        vertices.array[idx * 3] = 0;
                        vertices.array[idx * 3 + 1] = 0;
                        vertices.array[idx * 3 + 2] = 0;
                    }
                    vertices.needsUpdate = true;
                    
                    // Create destruction effect
                    createFragments(data.position, data.scale);
                    break;
                }
            }
        }
    });

    // Also remove from picking scene
    pickingScene.traverse((object) => {
        if (object.isMesh && object.geometry.attributes.id) {
            const ids = object.geometry.attributes.id.array;
            const vertices = object.geometry.attributes.position;
            
            for (let i = 0; i < vertices.count; i += 24) {
                if (ids[i] === id) {
                    for (let j = 0; j < 24; j++) {
                        const idx = i + j;
                        vertices.array[idx * 3] = 0;
                        vertices.array[idx * 3 + 1] = 0;
                        vertices.array[idx * 3 + 2] = 0;
                    }
                    vertices.needsUpdate = true;
                    break;
                }
            }
        }
    });

    // Dispatch cube destroyed event
    window.dispatchEvent(new CustomEvent('cubeDestroyed', {
        detail: {
            id: id,
            scene: scene
        }
    }));
}

function createFragments(position, scale, destructionType = 0) {
    // Vary parameters based on destruction type
    const config = {
        0: { // Default
            fragmentCount: 8,
            fragmentSize: 4,
            spread: 2,
            gravity: gravity,
            upwardForce: 2
        },
        1: { // Fast fall, many pieces
            fragmentCount: 12,
            fragmentSize: 5,
            spread: 3,
            gravity: new THREE.Vector3(0, -0.025, 0),
            upwardForce: 1.5
        },
        2: { // Explosive
            fragmentCount: 6,
            fragmentSize: 3,
            spread: 4,
            gravity: new THREE.Vector3(0, -0.01, 0),
            upwardForce: 3
        },
        3: { // Implosive
            fragmentCount: 10,
            fragmentSize: 6,
            spread: 1,
            gravity: new THREE.Vector3(0, -0.02, 0),
            upwardForce: 1
        }
    }[destructionType];

    const fragmentSize = Math.min(scale.x, scale.y, scale.z) / config.fragmentSize;
    
    // Array of possible geometries for fragments
    const geometries = [
        () => new THREE.TetrahedronGeometry(fragmentSize * 0.8),
        () => new THREE.OctahedronGeometry(fragmentSize * 0.7),
        () => new THREE.BoxGeometry(fragmentSize, fragmentSize, fragmentSize),
        () => new THREE.DodecahedronGeometry(fragmentSize * 0.6),
        () => new THREE.IcosahedronGeometry(fragmentSize * 0.7)
    ];

    const fragmentMaterial = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        flatShading: true,
        shininess: 0
    });

    // Create fragments with varying count
    for (let i = 0; i < config.fragmentCount; i++) {
        const randomGeometry = geometries[Math.floor(Math.random() * geometries.length)]();
        
        const angle = (i / config.fragmentCount) * Math.PI * 2;
        const radius = fragmentSize * config.spread;
        
        const offset = new THREE.Vector3(
            Math.cos(angle) * radius,
            Math.random() * radius,
            Math.sin(angle) * radius
        );

        const fragmentPos = position.clone().add(offset);
        
        // Adjust velocity based on config
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * config.spread,
            Math.random() * config.upwardForce,
            (Math.random() - 0.5) * config.spread
        );

        const rotation = new THREE.Vector3(
            Math.random() * 0.05,
            Math.random() * 0.05,
            Math.random() * 0.05
        );

        fragments.push(new Fragment(
            randomGeometry,
            fragmentMaterial,
            fragmentPos,
            velocity,
            rotation,
            config.gravity // Pass custom gravity to Fragment
        ));
    }
}

function init() {
    container = document.getElementById('container');

    // Adjust initial camera position to be closer
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.z = 2000;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    scene.add(new THREE.AmbientLight(0xcccccc));

    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(0, 500, 2000);
    scene.add(light);

    const defaultMaterial = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        flatShading: true,
        vertexColors: true,
        shininess: 0
    });

    pickingScene = new THREE.Scene();
    pickingTexture = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.IntType,
        format: THREE.RGBAIntegerFormat,
        internalFormat: 'RGBA32I',
    });

    const pickingMaterial = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: /* glsl */`
            attribute int id;
            flat varying int vid;
            void main() {
                vid = id;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            layout(location = 0) out int out_id;
            flat varying int vid;
            void main() {
                out_id = vid;
            }
        `,
    });

    function applyId(geometry, id) {
        const position = geometry.attributes.position;
        const array = new Int16Array(position.count);
        array.fill(id);
        const bufferAttribute = new THREE.Int16BufferAttribute(array, 1, false);
        bufferAttribute.gpuType = THREE.IntType;
        geometry.setAttribute('id', bufferAttribute);
    }

    function applyVertexColors(geometry, color) {
        const position = geometry.attributes.position;
        const colors = [];
        for (let i = 0; i < position.count; i++) {
            colors.push(color.r, color.g, color.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }

    const geometries = [];
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const defaultColor = new THREE.Color(0xcccccc);

    for (let i = 0; i < 5000; i++) {
        const geometry = new THREE.BoxGeometry();
        const position = new THREE.Vector3();
        
        if (i in cubeBlogMappings) {
            // Position blog cubes in a circle around the center
            const angle = (i / Object.keys(cubeBlogMappings).length) * Math.PI * 2;
            position.x = Math.cos(angle) * 800;
            position.y = Math.sin(angle) * 800;
            position.z = 500;
        } else {
            position.x = Math.random() * 10000 - 5000;
            position.y = Math.random() * 6000 - 3000;
            position.z = Math.random() * 8000 - 4000;
        }

        const rotation = new THREE.Euler();
        rotation.x = Math.random() * 2 * Math.PI;
        rotation.y = Math.random() * 2 * Math.PI;
        rotation.z = Math.random() * 2 * Math.PI;

        const scale = new THREE.Vector3();
        if (i in cubeBlogMappings) {
            // Make blog cubes a consistent size
            scale.x = scale.y = scale.z = 200;
        } else {
            scale.x = Math.random() * 200 + 100;
            scale.y = Math.random() * 200 + 100;
            scale.z = Math.random() * 200 + 100;
        }

        quaternion.setFromEuler(rotation);
        matrix.compose(position, quaternion, scale);
        geometry.applyMatrix4(matrix);

        // Color special cubes according to their mapping
        if (i in cubeBlogMappings) {
            const blogMaterial = new THREE.MeshPhongMaterial({
                color: cubeBlogMappings[i].color,
                flatShading: true,
                shininess: 30
            });
            applyVertexColors(geometry, new THREE.Color(cubeBlogMappings[i].color));
            applyId(geometry, i);
            
            // Add to both scenes
            const mainMesh = new THREE.Mesh(geometry, blogMaterial);
            const pickingMesh = new THREE.Mesh(geometry.clone(), pickingMaterial);
            
            scene.add(mainMesh);
            pickingScene.add(pickingMesh);
        } else {
            applyVertexColors(geometry, defaultColor);
            applyId(geometry, i);
            geometries.push(geometry);
        }
        
        pickingData[i] = {
            position: position,
            rotation: rotation,
            scale: scale
        };
    }

    const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
    scene.add(new THREE.Mesh(mergedGeometry, defaultMaterial));
    pickingScene.add(new THREE.Mesh(mergedGeometry, pickingMaterial));

    highlightBox = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            side: THREE.FrontSide,
            wireframe: true,
            wireframeLinewidth: 2
        })
    );
    highlightBox.scale.multiplyScalar(1.2);
    highlightBox.visible = false;
    scene.add(highlightBox);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    container.appendChild(renderer.domElement);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.noZoom = false;
    controls.noPan = false;
    controls.staticMoving = true;
    controls.dynamicDampingFactor = 0.3;

    // Add zoom constraints
    controls.minDistance = 1000;
    controls.maxDistance = 3500;

    // Add event listeners for user interaction
    controls.addEventListener('start', () => {
        stopAutoRotation();
    });

    // Add change event listener to close menu when camera moves
    controls.addEventListener('change', () => {
        closeMenu();
    });

    // Update event listeners
    container.addEventListener('pointerdown', onPointerStart);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerStart(event) {
    event.preventDefault();
    stopAutoRotation();
    
    // Store initial pointer position
    pointerStartPosition.x = event.clientX;
    pointerStartPosition.y = event.clientY;
    hasMoved = false;
}

function onPointerMove(event) {
    // Check if user has moved beyond threshold
    if (!hasMoved) {
        const dx = event.clientX - pointerStartPosition.x;
        const dy = event.clientY - pointerStartPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > MOVE_THRESHOLD) {
            hasMoved = true;
        }
    }
}

function onPointerUp(event) {
    event.preventDefault();
    
    // If user moved significantly, don't process the click
    if (hasMoved) {
        return;
    }

    // Get pointer coordinates
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Perform picking
    pick();

    const currentTime = Date.now();
    const menu = document.getElementById('cube-menu');
    
    // Close menu if clicking outside a cube
    if (pickedId === -1) {
        closeMenu();
        return;
    }

    // Handle destroyed cubes
    if (pickingData[pickedId]?.destroyed) {
        closeMenu();
        return;
    }

    // Handle cube interactions
    if (pickedId === selectedCubeId && currentTime - lastInteractionTime < INTERACTION_TIMEOUT) {
        // Second click on the same cube
        if (pickedId in cubeBlogMappings) {
            // For cubes with blog mappings, execute their custom second click action
            const mapping = cubeBlogMappings[pickedId];
            if (mapping.onSecondClick) {
                mapping.onSecondClick(scene.getObjectById(pickedId), scene, getAllCubes());
            } else {
                showBlogPost(); // Default action for blog cubes is to show the post
            }
        } else {
            // For regular cubes, destroy them
            destroyCube(pickedId);
        }
        closeMenu();
    } else {
        // First click - select the cube and show appropriate menu
        if (menu.style.display === 'block') {
            closeMenu();
        }
        selectedCubeId = pickedId;
        lastInteractionTime = currentTime;
        
        // Show highlight box
        const data = pickingData[pickedId];
        highlightBox.visible = true;
        highlightBox.position.copy(data.position);
        highlightBox.rotation.copy(data.rotation);
        const highlightScale = data.scale.clone().multiplyScalar(1.1);
        highlightBox.scale.copy(highlightScale);
        
        // Show appropriate menu based on cube type
        const clickPosition = {
            x: event.clientX,
            y: event.clientY
        };
        
        if (pickedId in cubeBlogMappings) {
            // Show blog menu for cubes with blog mappings
            showCubeMenu(clickPosition);
        } else {
            // Show generic menu for regular cubes
            showGenericCubeMenu(clickPosition);
        }
    }
}

// Helper function to get all cubes in the scene
function getAllCubes() {
    const cubes = [];
    scene.traverse((object) => {
        if (object.isMesh && object.geometry.attributes.id) {
            cubes.push(object);
        }
    });
    return cubes;
}

// Function to show generic menu for regular cubes
function showGenericCubeMenu(screenPosition) {
    const menu = document.getElementById('cube-menu');
    const title = menu.querySelector('.menu-title');
    const brief = menu.querySelector('.menu-brief');
    const metadata = menu.querySelector('.menu-metadata');
    const readButton = document.getElementById('read-button');

    title.textContent = 'Regular Cube';
    brief.textContent = 'Click again to destroy this cube';
    metadata.style.display = 'none';
    readButton.style.display = 'none';

    // Position menu near the cube
    menu.style.left = `${screenPosition.x + 10}px`;
    menu.style.top = `${screenPosition.y + 10}px`;
    menu.style.display = 'block';
}

function pick() {
    // render the picking scene off-screen
    const dpr = window.devicePixelRatio;
    
    // Calculate pixel coordinates
    const x = Math.floor((pointer.x + 1) * renderer.domElement.width / 2);
    const y = Math.floor((-pointer.y + 1) * renderer.domElement.height / 2);

    // Set camera view to look at just that pixel
    camera.setViewOffset(
        renderer.domElement.width,
        renderer.domElement.height,
        x,
        y,
        1,
        1
    );

    renderer.setRenderTarget(pickingTexture);
    renderer.render(pickingScene, camera);

    // read the pixel
    const pixelBuffer = new Int32Array(4);
    renderer.readRenderTargetPixels(pickingTexture, 0, 0, 1, 1, pixelBuffer);
    renderer.setRenderTarget(null);

    // restore the camera
    camera.clearViewOffset();

    const id = pixelBuffer[0];
    pickedId = id;
}

function animate(time) {
    const deltaTime = lastTime ? (time - lastTime) / 1000 : 0; // Convert to seconds
    lastTime = time;

    // Check for inactivity
    checkInactivity();

    // Apply auto-rotation if active
    if (autoRotating) {
        const rotationAmount = AUTO_ROTATION_SPEED * deltaTime;
        scene.rotation.y += rotationAmount;
        pickingScene.rotation.y += rotationAmount;
    }

    // Update fragments safely
    if (fragments && fragments.length > 0) {
        for (let i = fragments.length - 1; i >= 0; i--) {
            if (fragments[i] && fragments[i].update) {
                if (fragments[i].update()) {
                    fragments.splice(i, 1);
                }
            }
        }
    }

    render();
}

function render() {
    controls.update();
    
    if (highlightBox.visible && pickedId !== -1) {
        const data = pickingData[pickedId];
        if (data) {
            highlightBox.rotation.copy(data.rotation);
        }
    }
    
    renderer.render(scene, camera);
}

function showCubeMenu(screenPosition) {
    const menu = document.getElementById('cube-menu');
    const menuTitle = menu.querySelector('.menu-title');
    const menuBrief = menu.querySelector('.menu-brief');
    const menuAuthor = menu.querySelector('.menu-metadata .author');
    const menuDate = menu.querySelector('.menu-metadata .date');
    
    // Set the content from the blog mapping
    if (pickedId in cubeBlogMappings) {
        const post = cubeBlogMappings[pickedId];
        menuTitle.textContent = post.title;
        menuBrief.textContent = post.brief;
        menuAuthor.textContent = post.author;
        menuDate.textContent = post.date;
    }
    
    // Make menu visible to get dimensions
    menu.style.display = 'block';
    menu.style.opacity = '0';
    
    // Get dimensions and viewport info
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth <= 768;
    const menuRect = menu.getBoundingClientRect();
    
    // Define safe margins and zones
    const TOP_MARGIN = 80;
    const EDGE_MARGIN = 20;
    const SPACING = 20;
    const CENTER_ZONE_SIZE = 0.4; // 40% of viewport height for center zone
    const CENTER_OFFSET = 100; // How much to move up in center zone
    
    let top;
    
    if (isMobile) {
        // On mobile, position relative to click but ensure visibility
        top = screenPosition.y;
        
        // Check if in vertical center zone
        const centerZoneTop = viewportHeight * (0.5 - CENTER_ZONE_SIZE / 2);
        const centerZoneBottom = viewportHeight * (0.5 + CENTER_ZONE_SIZE / 2);
        const isInCenterZone = screenPosition.y >= centerZoneTop && screenPosition.y <= centerZoneBottom;
        
        if (isInCenterZone) {
            // If in center zone, position menu higher
            top = Math.max(TOP_MARGIN, screenPosition.y - menuRect.height - CENTER_OFFSET);
        } else if (top + menuRect.height > viewportHeight - EDGE_MARGIN) {
            // If would go below viewport, show above click point
            top = Math.max(TOP_MARGIN, screenPosition.y - menuRect.height - SPACING);
        }
        
        // If still too low, force it to start from TOP_MARGIN
        if (top + menuRect.height > viewportHeight - EDGE_MARGIN) {
            top = TOP_MARGIN;
        }
        
        // Apply mobile positioning
        menu.style.top = `${top}px`;
        menu.style.transform = 'none';
        menu.style.left = '20px';
        menu.style.right = '20px';
        menu.style.width = 'auto';
    } else {
        // Desktop positioning
        let left;
        
        // Horizontal positioning
        const isInLeftHalf = screenPosition.x < viewportWidth / 2;
        if (isInLeftHalf) {
            left = screenPosition.x + SPACING;
        } else {
            left = screenPosition.x - menuRect.width - SPACING;
        }
        
        // Check if in vertical center zone
        const centerZoneTop = viewportHeight * (0.5 - CENTER_ZONE_SIZE / 2);
        const centerZoneBottom = viewportHeight * (0.5 + CENTER_ZONE_SIZE / 2);
        const isInCenterZone = screenPosition.y >= centerZoneTop && screenPosition.y <= centerZoneBottom;
        
        // Vertical positioning for desktop
        if (isInCenterZone) {
            // If in center zone, position menu higher
            top = Math.max(TOP_MARGIN, screenPosition.y - menuRect.height - CENTER_OFFSET);
        } else {
            top = screenPosition.y;
            if (top + menuRect.height > viewportHeight - EDGE_MARGIN) {
                top = screenPosition.y - menuRect.height - SPACING;
            }
        }
        
        // Ensure menu stays within viewport bounds
        if (left < EDGE_MARGIN) {
            left = EDGE_MARGIN;
        } else if (left + menuRect.width > viewportWidth - EDGE_MARGIN) {
            left = viewportWidth - menuRect.width - EDGE_MARGIN;
        }
        
        if (top < TOP_MARGIN) {
            top = TOP_MARGIN;
        }
        
        // Apply desktop positioning
        menu.style.left = `${left}px`;
        menu.style.right = 'auto';
        menu.style.width = '';
        menu.style.top = `${top}px`;
    }
    
    // Make menu visible
    menu.style.opacity = '1';
}

function onCubeClick(event) {
    const currentTime = Date.now();
    const cube = event.object;
    const cubeId = cube.userData.id;
    const mapping = cubeBlogMappings[cubeId];

    if (mapping) {
        if (cube === lastClickedCube && (currentTime - lastClickTime) < DOUBLE_CLICK_DELAY) {
            // Second click on the same cube
            if (mapping.onSecondClick) {
                mapping.onSecondClick(cube, scene, cubes);
            }
        } else {
            // First click
            showCubeMenu(screenPosition);
        }

        lastClickedCube = cube;
        lastClickTime = currentTime;
    }
}

// Add this new function to manage cube colors
function resetCubeColors(scene) {
    scene.traverse((object) => {
        if (object.isMesh && object.geometry.attributes.id) {
            const ids = object.geometry.attributes.id.array;
            const colors = object.geometry.attributes.color;
            
            // Reset all cubes to gray except the green cube (ID 100)
            for (let i = 0; i < ids.length; i++) {
                if (ids[i] !== 100) {
                    const color = new THREE.Color(0x808080);
                    colors.setXYZ(i, color.r, color.g, color.b);
                }
            }
            colors.needsUpdate = true;
        }
    });
} 