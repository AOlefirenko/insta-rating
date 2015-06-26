import Rx from 'rx';
import angular from 'angular';
import 'rx-angular';

var app = angular.module('app', ['rx']);

angular.element(document).ready(function () {
    return angular.bootstrap(document.body, [app.name]);
});


function getItems(count, boxId) {
    return Rx.Observable.range(1, count).
        map((x)=> {

            return {id: x, title: 'item ' + x, boxId: boxId};
        })
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
            console.log('activate helper', groups);
            this.init(groups);
        }
    }

    makePairs(sections) {
        return makePairs(sections.concat(sections.take(1)));
    }

    setStartPosition(groups, position) {
        return groups.skipWhile((x)=> position && x.current.id !== position);
    }

    setCurrentValues(x) {
        this.values = x;
        this.positionObservable.onNext({id: x.current.id, boxId: this.id});
    }

    setInitValues(observable) {
        observable.take(1).subscribe(this.setCurrentValues.bind(this));
    }

    initRolling(observable, allGroups) {
        var self = this;
        var onRollUp = Rx.Observable.create(function (observer) {
            self.rollUp = observer.onNext.bind(observer);
            return function () {
                console.log('disposed');
            };
        })
        var obs = Rx.Observable.zip(observable.skip(1), onRollUp, (s1, s2)=> s1);

        obs.subscribe(this.setCurrentValues.bind(this),
            angular.noop,
            (x)=> {
                onRollUp = null;
                obs = null;
                observable = null;
                self.init(allGroups, true)
            })
    }

    init(groups, isRecursiveCall) {

        var startPosition = !isRecursiveCall && this.currentItemId;

        var publishedGroups = this.setStartPosition(groups, startPosition).publish();

        this.setInitValues(publishedGroups);
        this.initRolling(publishedGroups, groups);

        publishedGroups.connect();
    }

}

class RolledHelpersGroup {
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
        });

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
    var newSections = ['fourth', 'fifth', 'sixth'];
    var onNextBoxObservable = $scope.$createObservableFunction('nextSection');

    var stickiesDict = {
        'first': getItems(9, 'first'),
        'second': getItems(0, 'second'),
        'third': getItems(6, 'third'),
        'fourth': getItems(2, 'fourth'),
        'fifth': getItems(0, 'fifth'),
        'sixth': getItems(1, 'sixth')
    }

    var rolledGuideState = {
        currentBoxId: 'first',
        completed: false,
        completedOn: new Date(),
        boxes: {
            first: {
                isDirty: true,
                resumed:false,
                currentItemId: 1
            },
            second: {
                isDirty: false,
                resumed:false,
                currentItemId: 1
            }
        },
        setCurrentItem: function (boxId, id) {
            if (!this.boxes[boxId])this.boxes[boxId] = {};
            this.boxes[boxId].currentItemId = id;
        },
        getCurrentItem: function (boxId) {
            if (!this.boxes[boxId])return;
            return this.boxes[boxId].currentItemId
        },
        setDirty: function (boxId) {
            this.boxes[boxId].isDirty = true;
        }
    };

//////////////////////
//////////////////////
    function initObs(sections) {
        var boxes = setHelperForEachBox(setItemsExistence(mapBoxes(sections)));

        getAll(boxes, (x)=> {
            console.log('all', x);
        });
        var nextSectionTest = $scope.$createObservableFunction('nextSectionTest');

        listenOnNext(boxes, nextSectionTest).subscribe(function (x) {
            console.log('next', x);
        })


        function mapBoxes(sections) {
            return Rx.Observable.fromArray(sections).map((x)=> {
                return {
                    id: x,
                    title: x,
                    stickies: stickiesDict[x],
                    onNextBoxObservable: new Rx.Subject()
                }
            });
        }

        function setItemsExistence(boxes) {
            var hasItems = boxes.flatMap((x)=> {
                return x.stickies.some();
            });
            return Rx.Observable.zip(boxes, hasItems, (s1, s2)=> {
                s1.hasStickies = s2;
                return s1;
            });
        }

        function setHelperForEachBox(boxes) {
            return makePairs(boxes.concat(Rx.Observable.fromArray([null]))).map((x)=> {
                var config = {
                    boxId: x.current.id,
                    nextBoxTitle: x.next && x.next.title,
                    stickies: x.current.stickies,
                    currentStickyId: 0,
                    rolledUpObservable: new Rx.Subject()
                };
                x.current.helper = new RolledHelper(config);
                return x.current;
            })
        }

        function getAll(boxes, cb) {
            boxes.map((x)=> {
                x.stickies.toArray().subscribe((items)=> {
                    x.stickies = items;
                })
                return x;
            }).toArray().subscribe(cb);
        }

        function listenOnNext(boxes, OnNext) {
            return Rx.Observable.zip(boxes.where((x)=>x.hasStickies), OnNext, (s1, s2)=>s1);
        }
    }


    initObs(sections);


//////////////////////
//////////////////////

    var currentId;
    init(sections);

    function init(sections) {
        var boxesObservable = Rx.Observable.fromArray(sections);

        if ($scope.guideHelpers) $scope.guideHelpers.dispose();

        var guideHelpers = new RolledHelpersGroup(boxesObservable, onNextBoxObservable, stickiesDict, rolledGuideState);
        $scope.guideHelpers = guideHelpers;

        $scope.sections = guideHelpers.allBoxes;

        guideHelpers.onNext((x)=> {
            rolledGuideState.currentBoxId = x.current;
            rolledGuideState.setDirty(x.completed);
        })
        guideHelpers.onRolledUp((x)=> {
            rolledGuideState.setCurrentItem(x.boxId, x.id);
        })
    }

    $scope.addSection = (x)=> {
        var newBox = newSections.pop();
        if (!newBox) return;
        sections.push(newBox);
        init(sections);
    }
});
