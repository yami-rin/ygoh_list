--神折の巫女－オリヒメ
--Kamiori Shrine Maiden - Orihime (original card)
local s,id=GetID()
local SET_KAMIORI=0x7c5
function s.initial_effect(c)
	--① Normal Summoned: place 2 "Kamiori" Continuous Spells/Traps with different names from the Deck face-up,
	--   then only Fairy monsters can be Special Summoned for the rest of this turn
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,0))
	e1:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e1:SetProperty(EFFECT_FLAG_DELAY)
	e1:SetCode(EVENT_SUMMON_SUCCESS)
	e1:SetTarget(s.pltg)
	e1:SetOperation(s.plop)
	c:RegisterEffect(e1)
	--② send 1 face-up card you control to the GY: Special Summon 1 "Kamiori" monster except this card's name from the Deck
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetCategory(CATEGORY_SPECIAL_SUMMON)
	e2:SetType(EFFECT_TYPE_IGNITION)
	e2:SetRange(LOCATION_MZONE)
	e2:SetCountLimit(1,{id,1})
	e2:SetCost(s.spcost)
	e2:SetTarget(s.sptg)
	e2:SetOperation(s.spop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_KAMIORI}
s.listed_names={id}
function s.plfilter(c)
	return c:IsSetCard(SET_KAMIORI) and c:IsType(TYPE_CONTINUOUS) and c:IsSpellTrap() and not c:IsForbidden()
end
function s.pltg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then
		local g=Duel.GetMatchingGroup(s.plfilter,tp,LOCATION_DECK,0,nil)
		return Duel.GetLocationCount(tp,LOCATION_SZONE)>=2 and g:GetClassCount(Card.GetCode)>=2
	end
	--"この効果の発動後": applied on activation, so it stays even if the effect is negated or the placement does not happen
	local e1=Effect.CreateEffect(e:GetHandler())
	e1:SetType(EFFECT_TYPE_FIELD)
	e1:SetProperty(EFFECT_FLAG_PLAYER_TARGET)
	e1:SetCode(EFFECT_CANNOT_SPECIAL_SUMMON)
	e1:SetTargetRange(1,0)
	e1:SetTarget(function(_,sc) return not sc:IsRace(RACE_FAIRY) end)
	e1:SetReset(RESET_PHASE+PHASE_END)
	Duel.RegisterEffect(e1,tp)
end
function s.plop(e,tp,eg,ep,ev,re,r,rp)
	local ct=math.min(2,(Duel.GetLocationCount(tp,LOCATION_SZONE)))
	local g=Duel.GetMatchingGroup(s.plfilter,tp,LOCATION_DECK,0,nil)
	if ct<=0 or #g==0 then return end
	--different names: pick one, drop its name from the rest, pick again
	local sg=Group.CreateGroup()
	for i=1,ct do
		if #g==0 then break end
		Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOFIELD)
		local tc=g:Select(tp,1,1,nil):GetFirst()
		sg:AddCard(tc)
		g:Remove(Card.IsCode,nil,tc:GetCode())
	end
	for tc in aux.Next(sg) do
		Duel.MoveToField(tc,tp,tp,LOCATION_SZONE,POS_FACEUP,true)
	end
end
function s.cfilter(c,tp)
	return c:IsFaceup() and c:IsAbleToGraveAsCost() and Duel.GetMZoneCount(tp,c)>0
end
function s.spcost(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.cfilter,tp,LOCATION_ONFIELD,0,1,nil,tp) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_TOGRAVE)
	local g=Duel.SelectMatchingCard(tp,s.cfilter,tp,LOCATION_ONFIELD,0,1,1,nil,tp)
	Duel.SendtoGrave(g,REASON_COST)
end
function s.spfilter(c,e,tp)
	return c:IsSetCard(SET_KAMIORI) and c:IsMonster() and not c:IsCode(id) and c:IsCanBeSpecialSummoned(e,0,tp,false,false)
end
function s.sptg(e,tp,eg,ep,ev,re,r,rp,chk)
	if chk==0 then return Duel.IsExistingMatchingCard(s.spfilter,tp,LOCATION_DECK,0,1,nil,e,tp) end
	Duel.SetOperationInfo(0,CATEGORY_SPECIAL_SUMMON,nil,1,tp,LOCATION_DECK)
end
function s.spop(e,tp,eg,ep,ev,re,r,rp)
	if Duel.GetLocationCount(tp,LOCATION_MZONE)<=0 then return end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_SPSUMMON)
	local g=Duel.SelectMatchingCard(tp,s.spfilter,tp,LOCATION_DECK,0,1,1,nil,e,tp)
	if #g>0 then Duel.SpecialSummon(g,0,tp,tp,false,false,POS_FACEUP) end
end
