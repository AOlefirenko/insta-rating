import Rx from 'rx';
import angular from 'angular';
import 'rx-angular';

var app = angular.module('app', ['rx']);

angular.element(document).ready(function () {
    return angular.bootstrap(document.body, [app.name]);
});




app.controller('AppController', ($scope)=> {

    function getItems(count) {
        return Rx.Observable.range(1, count).
            map((x)=> {
                return {id: x, title: 'item ' + x};
            }).concat(Rx.Observable.fromArray([null]));
    }

    var items = getItems(5);

    var currentItemId = 2;

    var sections = ['first', 'second', 'third'];

    var sectionsObserver = Rx.Observable.fromArray(sections).
        map((x)=> {
            return {
                id: x,
                items: getItems(x.length).pairwise().
                    map((x) => {
                        return {
                            current: x[0], next: x[1]
                        }
                    }).skipWhile((x)=> currentItemId && x.current.id !== currentItemId),
                currentItemId: null
            }
        });

    sectionsObserver.toArray().subscribe((x)=> {
        $scope.sections = x;
    })


    var onNext = $scope.$createObservableFunction('nextItem');
    var onNextSection = $scope.$createObservableFunction('nextSection');

    var pairs = items.pairwise().
        map((x) => {
            return {
                current: x[0], next: x[1]
            }
        }).
        skipWhile((x)=> currentItemId && x.current.id !== currentItemId);

    var published = pairs.publish();
    var publishedSections = sectionsObserver.publish();

    published.take(1).
        subscribe(setData);

    publishedSections.take(1).
        subscribe((x)=> {
            $scope.currentSection = x;
        });

    Rx.Observable.zip(published.skip(1), onNext, (s1, s2)=> s1).subscribe(setData)

    Rx.Observable.zip(publishedSections.skip(1), onNextSection, (s1, s2)=> s1).subscribe((x)=> {
        $scope.currentSection = x;
    })

    published.connect();
    publishedSections.connect();


    function setData(x) {
        $scope.data = x;
    }
});