import Rx from 'rx';
import angular from 'angular';
import 'rx-angular';

var app = angular.module('app', ['rx']);

angular.element(document).ready(function () {
    return angular.bootstrap(document.body, [app.name]);
});


function getItems(count) {
    return Rx.Observable.range(1, count).
        map((x)=> {
            return {id: x, title: 'item ' + x};
        });
}

var i = 2;

function makePairs(observable) {
    return observable.
        pairwise().
        map((x) => {
            return {
                current: x[0], next: x[1]
            }
        });
}


class RolledHelper {
    constructor(config) {
        this.id = config.boxId;
        this.title = config.title;
        this.nextBoxTitle = config.nextBoxTitle;

        var groups = this.makePairs(config.stickies);

        this._subscriptions = [];

        this.currentItemId = config.currentStickyId;

        this.positionObservable = config.rolledUpObservable;

        this.activate = function () {
            console.log('activate helper');
            this.init(groups);
        }
    }

    makePairs(sections) {
        return makePairs(sections.concat(sections.take(1)));
    }

    setStartPosition(groups, position) {
        return groups.skipWhile((x)=> position && x.current.id !== position);
    }

    init(groups, isRecursiveCall) {

        var startPosition = !isRecursiveCall && this.currentItemId;
        var publishedGroups = this.setStartPosition(groups, startPosition).publish();

        publishedGroups.take(1).
            subscribe((x)=> {
                this.values = x;
                console.log('publishedGroups', x);
                this.positionObservable.onNext({id: x.current.id, boxId: this.id});
            });

        var self = this;
        var onRollUp = Rx.Observable.create(function (observer) {
            self.rollUp = observer.onNext.bind(observer);
            return function () {
                console.log('disposed');
            };
        })
        var obs = Rx.Observable.zip(publishedGroups.skip(1), onRollUp, (s1, s2)=> s1);
        obs.subscribe((x)=> {
                this.values = x;
                this.positionObservable.onNext({id: x.current.id, boxId: this.id});
            },
            angular.noop,
            (x)=> {
                onRollUp = null;
                obs = null;
                publishedGroups = null;
                self.init(groups, true)
            })
        publishedGroups.connect();
    }

    rollUp() {

    }
}

class GuideHelpers {
    constructor(sections, onNext, stickies, state) {
        this.sections = this.makePairs(sections).
            map(this.transformToHelper.bind(this));

        this.observable = Rx.Observable.zip(this.sections, onNext, (s1, s2)=> s1);

        this.stickiesDict = stickies;

        var publishedSections = this.sections.publish();

        this._subscriptions = [];
        this.state = state;
        var currentSectionId = state.currentBoxId;

        var helpersObservable = publishedSections.skipWhile((x)=> currentSectionId && x.id !== currentSectionId);

        this.createSubscription(helpersObservable.take(1), (x)=> {
            this.currentSectionId = x.id;
            x.activate();
        })

        this.createSubscription(publishedSections.toArray(), (x)=> {
            this.allBoxes = x;
        });

        this.guideObservable = Rx.Observable.zip(helpersObservable.skip(1), onNext, (s1, s2)=> s1);

        var positionObservable = new Rx.Subject();
        this.rolledUpObservable = new Rx.Subject();
        this.createSubscription(this.guideObservable, (x)=> {
            this.prevSectionId = this.currentSectionId;
            this.currentSectionId = x.id;
            x.activate();

            positionObservable.onNext({
                current: this.currentSectionId,
                completed: this.prevSectionId
            });
        })
        this.positionObservable = positionObservable;

        publishedSections.connect();
    }

    createSubscription(observable, cb) {
        this._subscriptions.push(observable.subscribe(cb));
    }

    makePairs(sections) {
        return makePairs(sections.concat(Rx.Observable.fromArray([null])));
    }

    transformToHelper(x) {
        //console.log('transformToHelper', x);
        var stickies = this.stickiesDict[x.current];
        var subject = this.rolledUpObservable;
        var currentItemId = this.state.getCurrentItem(x.current);
        var config = {
            boxId: x.current,
            title: x.current,
            nextBoxTitle: x.next,
            stickies: stickies,
            currentStickyId: currentItemId,
            rolledUpObservable: subject
        };


        return new RolledHelper(config);
    }

    onNext(func) {
        this.createSubscription(this.positionObservable, func)
    }

    onRolledUp(func) {
        this.createSubscription(this.rolledUpObservable, func)
    }

    dispose() {
        this.positionObservable.onCompleted();
        for (var i = 0; i < this._subscriptions.length; i++) {
            this._subscriptions[i].dispose();
        }
    }
}


app.controller('AppController', ($scope, rx, $window)=> {
    var sections = ['first', 'second', 'third'];
    var newSections = ['sixth', 'fifth', 'fourth'];
    var onNextBoxObservable = $scope.$createObservableFunction('nextSection');
    var stickiesDict = {
        'first': getItems(9),
        'second': getItems(5),
        'third': getItems(6),
        'fourth': getItems(2),
        'fifth': getItems(0),
        'sixth': getItems(0)
    }

    var rolledGuideState = {
        currentBoxId: 'first',
        completed: false,
        completedOn: new Date(),
        boxes: {
            first: {
                isDirty: true,
                currentItemId: 1
            },
            second: {
                isDirty: false,
                currentItemId: 1
            }
        },
        setCurrentItem:function(boxId,id){
            if(!this.boxes[boxId])this.boxes[boxId] ={};
            this.boxes[boxId].currentItemId = id;
        },
        getCurrentItem:function(boxId){
            if(!this.boxes[boxId])return;
            return this.boxes[boxId].currentItemId
        },
        resetBox: function () {

        }
    };

    var currentId;
    init(sections);

    function init(sections) {
        var boxesObservable = Rx.Observable.fromArray(sections);

        if ($scope.guideHelpers) $scope.guideHelpers.dispose();

        var guideHelpers = new GuideHelpers(boxesObservable, onNextBoxObservable, stickiesDict, rolledGuideState);
        $scope.guideHelpers = guideHelpers;

        $scope.sections = guideHelpers.allBoxes;


        guideHelpers.onNext((x)=> {
            console.log('SAVE', 'position changed to', x.current);
            console.log('SAVE', 'box completed', x.completed);
            rolledGuideState.currentBoxId = x.current;
        })
        guideHelpers.onRolledUp((x)=> {
            console.log('SAVE', 'sticky rolled up', x.id);
            console.log('SAVE', 'box', x.boxId);
            rolledGuideState.setCurrentItem(x.boxId,x.id);
        })
    }

    $scope.addSection = (x)=> {
        var newBox = newSections.pop();
        if (!newBox) return;
        sections.push(newBox);
        init(sections);
    }
});