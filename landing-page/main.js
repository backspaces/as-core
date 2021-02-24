import { createAntsView } from './models/createAntsView.js'
import { createFlockView } from './models/createFlockView.js'

import HelloPlusModel from '../models/HelloPlusModel.js'
import TwoDraw from '../src/TwoDraw.js'
import Model from '../src/Model.js'
import Color from '../../src/Color.js'
import ColorMap from '../../src/ColorMap.js'
import * as util from '../src/utils.js'

import { CodeBlock } from './src/codeblock.js'

window.util = util
window.Color = Color
window.ColorMap = ColorMap

let viewConfigs = [
    { view: createFlockView() },
    {
        view: createAntsView(),
        readyFn: (model) => {
            model.reset()
            model.setup()
        }
    },
]
let currentViewIndex = -1
let currentView

function nextModel() {
    let prevView = currentView
    currentViewIndex = (currentViewIndex + 1) % viewConfigs.length
    currentView = viewConfigs[currentViewIndex]

    if (currentView.readyFn) {
        currentView.readyFn(currentView.view.model)
    }

    if (prevView) {
        prevView.view.div.style.display = 'none'
    }
    currentView.view.div.style.display = 'block'

    setTimeout(() => nextModel(), 7000)
}

let whatIsABMView
let fixedView
let tutorialModelContainer
let fixedModelContainer
let model

function step() {
    currentView.view.model.step()
    currentView.view.draw()

    whatIsABMView.model.step()
    whatIsABMView.draw()

    fixedView.draw()
    
    setTimeout(() => step(), 20)
}

async function run() {
    let modelsContainer = document.querySelector('.models-container')

    // Add all the views to the document
    viewConfigs.forEach(({ view }) => {
        modelsContainer.appendChild(view.div)
        view.div.style.display = 'none'
    })

    // const whatIsABMModel = model = new HelloPlusModel({
    //     minX: 0,
    //     maxX: 25,
    //     minY: 0,
    //     maxY: 25
    // })
    const whatIsABMModel = window.model = new Model({
        minX: -5,
        maxX: 5,
        minY: -5,
        maxY: 5
    })
    whatIsABMView = new TwoDraw(whatIsABMModel, {
        div: document.querySelector('#tutorial-model'),
        patchSize: 40,
    },{
        patchesColor: (p) => p.color ? p.color : Color.typedColor('black')
    })

    fixedView = new TwoDraw(whatIsABMModel, {
        div: document.querySelector('#tutorial-model-fixed'),
        patchSize: 40,
    }, {
        patchesColor: (p) => p.color ? p.color : Color.typedColor('black')
    })

    tutorialModelContainer = document.querySelector('.tutorial-model-container')
    fixedModelContainer = document.querySelector('.tutorial-model-container-fixed')
    fixedModelContainer.style.display = 'none'
    fixedModelContainer.style.left = whatIsABMView.div.offsetLeft + 'px'

    // Set up code blocks
    document.querySelectorAll('[code-block]').forEach(el => {
      let codeContent = el.textContent
      let hasForeverButton = el.getAttribute('forever-button') !== null
      el.innerHTML = ''
      el.appendChild(new CodeBlock(whatIsABMModel).render({ codeContent, hasForeverButton }))
    })

    // Start cycling through models
    nextModel()

    // Start the animator
    step()
}
run()

document.addEventListener('scroll', (event) => {
    // Code smell. Must match .tutorial-model-container-fixed top css property
    let topPadding = 80;
    if (document.scrollingElement.scrollTop > (tutorialModelContainer.offsetTop - topPadding)) {
        tutorialModelContainer.style.visibility = 'hidden'
        fixedModelContainer.style.display = 'block'
    } else {
        tutorialModelContainer.style.visibility = 'visible'
        fixedModelContainer.style.display = 'none'
    }
})

document.querySelectorAll('[reset-model]').forEach(el => {
    el.addEventListener('click', () => window.model.reset())
})

// window.addEventListener('resize', () => {
//     viewConfigs.forEach(({ view }) => {
//         view.div.width = window.innerWidth
//         view.div.height = window.innerHeight
//     })
// })